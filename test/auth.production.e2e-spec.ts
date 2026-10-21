import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { startTestMongo } from './mongo';

describe('Auth API production responses', () => {
  let app: INestApplication;
  let mongo: MongoMemoryReplSet;

  beforeAll(async () => {
    mongo = await startTestMongo();
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'test-jwt-secret-with-32-characters-min';
    process.env.MONGODB_URI = mongo.getUri();
    process.env.AUTH_RATE_LIMIT = '100';
    process.env.CORS_ORIGIN = 'http://localhost';
    process.env.USE_DEFAULT_OTP = 'false';
    process.env.PORT = '4001';

    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  }, 180000);

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  it('does not return the OTP outside development', async () => {
    const server = app.getHttpServer();
    await request(server).post('/auth/signup').send({
      name: 'Asha',
      email: 'asha@example.com',
      mobile: '9876543210',
      password: 'secret1',
    });

    const forgot = await request(server)
      .post('/auth/forgot-password')
      .send({ identifier: 'asha@example.com' });
    expect(forgot.status).toBe(201);
    expect(forgot.body).toEqual({ message: 'OTP sent' });
    expect(forgot.body.otp).toBeUndefined();
  });
});
