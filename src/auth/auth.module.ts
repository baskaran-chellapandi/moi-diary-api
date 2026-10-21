import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { InjectModel, MongooseModule } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthRateLimitGuard } from '../common/guards/auth-rate-limit.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PasswordReset, PasswordResetSchema } from './password-reset.schema';
import { User, UserSchema } from './user.schema';

@Injectable()
class EnsureIndexes implements OnModuleInit {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(PasswordReset.name)
    private readonly resets: Model<PasswordReset>,
  ) {}

  async onModuleInit() {
    await this.users.createIndexes();
    await this.resets.createIndexes();
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: PasswordReset.name, schema: PasswordResetSchema },
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRateLimitGuard, JwtAuthGuard, EnsureIndexes],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
