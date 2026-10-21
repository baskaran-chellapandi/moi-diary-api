import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { ClientSession, Connection, Model, Query } from 'mongoose';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
  SignupDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { PasswordReset } from './password-reset.schema';
import { User } from './user.schema';

const OTP_MINUTES = 5;
const RESET_TOKEN_MINUTES = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly dummyHash = bcrypt.hashSync('timing-safe-placeholder', 10);

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(PasswordReset.name)
    private readonly resets: Model<PasswordReset>,
    @InjectConnection() private readonly connection: Connection,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signup(dto: SignupDto) {
    const email = dto.email.trim().toLowerCase();
    const mobile = digits(dto.mobile);
    try {
      const user = await this.runAtomic(async (session) => {
        const existing = await this.findUser(
          { $or: [{ email }, { mobile }] },
          session,
        );
        if (existing) {
          throw new ConflictException(
            'An account with this email or mobile number already exists.',
          );
        }
        const [created] = await this.users.create(
          [
            {
              name: dto.name.trim(),
              email,
              mobile,
              passwordHash: await bcrypt.hash(dto.password, 10),
            },
          ],
          sessionOptions(session),
        );
        return created;
      });
      return this.authResponse(user);
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (isDuplicateKey(error)) {
        throw new ConflictException(
          'An account with this email or mobile number already exists.',
        );
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.findByIdentifier(dto.identifier);
    const matches = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? this.dummyHash,
    );
    if (!user || !matches) {
      this.logger.warn('Login failed');
      throw new UnauthorizedException(
        'Incorrect email, mobile number, or password.',
      );
    }
    return this.authResponse(user);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.findByIdentifier(dto.identifier);
    if (!user) {
      throw new NotFoundException(
        'No account found for that email or mobile number.',
      );
    }

    const otp = this.config.get<boolean>('USE_DEFAULT_OTP')
      ? (this.config.get<string>('DEFAULT_OTP') ?? '4444')
      : String(randomInt(1000, 10000));
    await this.runAtomic(async (session) => {
      await this.resets.deleteMany(
        { userId: user.id },
        sessionOptions(session),
      );
      await this.resets.create(
        [
          {
            userId: user.id,
            codeHash: this.hashCode(otp),
            expiresAt: minutesFromNow(OTP_MINUTES),
            verifiedAt: null,
          },
        ],
        sessionOptions(session),
      );
    });

    this.logger.log(`Password reset requested userId=${user.id}`);
    return {
      message: 'OTP sent',
      ...(this.config.get<string>('NODE_ENV') === 'production' ? {} : { otp }),
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.findByIdentifier(dto.identifier);
    const reset = user
      ? await this.findReset(
          { userId: user.id, expiresAt: { $gt: new Date() } },
          null,
          { createdAt: -1 },
        )
      : null;
    const presented = this.hashCode(dto.otp);
    const matches = safeEqual(
      reset?.codeHash ?? '0'.repeat(presented.length),
      presented,
    );
    if (!user || !reset || !matches) {
      throw new BadRequestException('That OTP is incorrect.');
    }

    reset.verifiedAt = new Date();
    await reset.save();
    const resetToken = await this.jwt.signAsync(
      { sub: user.id, purpose: 'password-reset', resetId: reset.id },
      { expiresIn: `${RESET_TOKEN_MINUTES}m` },
    );
    return { resetToken };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.findUser({ _id: userId }, null);
    const matches = await bcrypt.compare(
      dto.currentPassword,
      user?.passwordHash ?? this.dummyHash,
    );
    if (!user || !matches) {
      throw new UnauthorizedException('Current password is incorrect.');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Choose a password that is different from the current one.');
    }
    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await user.save();
    this.logger.log(`Password changed userId=${user.id}`);
    return { message: 'Password updated' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const payload = await this.readResetToken(dto.resetToken);
    await this.runAtomic(async (session) => {
      const reset = await this.findReset(
        { _id: payload.resetId, userId: payload.sub },
        session,
      );
      if (!reset?.verifiedAt) {
        throw new UnauthorizedException(
          'Reset session expired. Request a new OTP.',
        );
      }
      const user = await this.findUser({ _id: payload.sub }, session);
      if (!user) {
        throw new NotFoundException(
          'No account found for that email or mobile number.',
        );
      }
      user.passwordHash = await bcrypt.hash(dto.password, 10);
      await user.save(sessionOptions(session));
      await this.resets.deleteMany(
        { userId: user.id },
        sessionOptions(session),
      );
    });
    this.logger.log(`Password reset completed userId=${payload.sub}`);
    return { message: 'Password updated' };
  }

  private async findByIdentifier(identifier: string) {
    const email = identifier.trim().toLowerCase();
    const mobile = digits(identifier);
    return this.findUser(
      { $or: [{ email }, ...(mobile ? [{ mobile }] : [])] },
      null,
    );
  }

  private findUser(
    filter: Record<string, unknown>,
    session: ClientSession | null,
  ) {
    return this.exec(this.users.findOne(filter), session);
  }

  private findReset(
    filter: Record<string, unknown>,
    session: ClientSession | null,
    sort?: Record<string, 1 | -1>,
  ) {
    const query = this.resets.findOne(filter);
    if (sort) query.sort(sort);
    return this.exec(query, session);
  }

  private exec<T>(query: Query<T, T>, session: ClientSession | null) {
    if (session) query.session(session);
    return query.exec();
  }

  private async runAtomic<T>(
    work: (session: ClientSession | null) => Promise<T>,
  ): Promise<T> {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const result = await work(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      if (isReplicaSetRequired(error)) return work(null);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  private async authResponse(user: User & { id: string }) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
    });
    return {
      accessToken,
      user: {
        name: user.name,
        email: user.email,
        mobile: user.mobile,
      },
    };
  }

  private async readResetToken(token: string) {
    try {
      const payload = await this.jwt.verifyAsync<{
        sub?: string;
        purpose?: string;
        resetId?: string;
      }>(token);
      if (
        payload.purpose !== 'password-reset' ||
        !payload.sub ||
        !payload.resetId
      ) {
        throw new UnauthorizedException(
          'Reset session expired. Request a new OTP.',
        );
      }
      return { sub: payload.sub, resetId: payload.resetId };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException(
        'Reset session expired. Request a new OTP.',
      );
    }
  }

  private hashCode(code: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(code)
      .digest('hex');
  }
}

function sessionOptions(session: ClientSession | null) {
  return session ? { session } : {};
}

function digits(value: string) {
  return value.replace(/\D/g, '');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function minutesFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function isDuplicateKey(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

function isReplicaSetRequired(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return (
    message.includes('replica set') || message.includes('Transaction numbers')
  );
}
