import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PasswordReset } from './password-reset.schema';
import { User } from './user.schema';

function queryOf<T>(value: T) {
  const query = {
    session: jest.fn(),
    sort: jest.fn(),
    exec: jest.fn().mockResolvedValue(value),
  };
  query.session.mockReturnValue(query);
  query.sort.mockReturnValue(query);
  return query;
}

describe('AuthService', () => {
  let service: AuthService;
  let users: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let resets: {
    findOne: jest.Mock;
    deleteMany: jest.Mock;
    create: jest.Mock;
  };
  let connection: { startSession: jest.Mock };
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };

  beforeEach(async () => {
    users = {
      findOne: jest.fn(),
      create: jest.fn(async (docs: object[]) =>
        docs.map((doc) => ({ id: 'user-1', ...doc })),
      ),
      save: jest.fn(),
    };
    resets = {
      findOne: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(async (docs: object[]) =>
        docs.map((doc) => ({ id: 'reset-1', ...doc })),
      ),
    };
    const session = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
      inTransaction: jest.fn(() => true),
    };
    connection = { startSession: jest.fn(async () => session) };
    jwt = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
      verifyAsync: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: users },
        { provide: getModelToken(PasswordReset.name), useValue: resets },
        { provide: getConnectionToken(), useValue: connection },
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'NODE_ENV') return 'test';
              if (key === 'USE_DEFAULT_OTP') return true;
              if (key === 'DEFAULT_OTP') return '4444';
              return undefined;
            },
            getOrThrow: () => 'test-jwt-secret-with-32-characters-min',
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('rejects a duplicate signup before inserting', async () => {
    users.findOne.mockReturnValue(queryOf({ id: 'existing' }));

    await expect(
      service.signup({
        name: 'Asha',
        email: 'asha@example.com',
        mobile: '9876543210',
        password: 'secret1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(users.create).not.toHaveBeenCalled();
  });

  it('returns the same error when the password is wrong or the account is missing', async () => {
    users.findOne.mockReturnValueOnce(queryOf(null));
    await expect(
      service.login({ identifier: 'missing@example.com', password: 'secret1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    users.findOne.mockReturnValueOnce(
      queryOf({
        id: 'user-1',
        passwordHash: await bcrypt.hash('secret1', 4),
      }),
    );
    await expect(
      service.login({ identifier: 'asha@example.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('issues the configured default OTP', async () => {
    users.findOne.mockReturnValue(queryOf({ id: 'user-1' }));

    await expect(
      service.forgotPassword({ identifier: 'asha@example.com' }),
    ).resolves.toEqual({ message: 'OTP sent', otp: '4444' });
  });

  it('does not issue a reset when the account does not exist', async () => {
    users.findOne.mockReturnValue(queryOf(null));

    await expect(
      service.forgotPassword({ identifier: 'missing@example.com' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(resets.create).not.toHaveBeenCalled();
  });

  it('rejects a reset token that is not a password-reset token', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', purpose: 'access' });

    await expect(
      service.resetPassword({ resetToken: 'token', password: 'secret2' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(users.save).not.toHaveBeenCalled();
  });
});
