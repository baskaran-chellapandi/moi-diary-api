import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { startTestMongo } from './mongo';

describe('Auth API', () => {
  let app: INestApplication;
  let mongo: MongoMemoryReplSet;

  beforeAll(async () => {
    mongo = await startTestMongo();
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-with-32-characters-min';
    process.env.MONGODB_URI = mongo.getUri();
    process.env.AUTH_RATE_LIMIT = '100';
    process.env.USE_DEFAULT_OTP = 'true';
    process.env.DEFAULT_OTP = '4444';
    process.env.PORT = '4001';

    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
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

  it('signs up, logs in, resets the password, and rejects bad input', async () => {
    const server = app.getHttpServer();
    const signup = await request(server).post('/auth/signup').send({
      name: 'Asha',
      email: 'asha@example.com',
      mobile: '9876543210',
      password: 'secret1',
    });
    expect(signup.status).toBe(201);
    expect(signup.body.user).toEqual({
      name: 'Asha',
      email: 'asha@example.com',
      mobile: '9876543210',
    });
    expect(signup.body.user.passwordHash).toBeUndefined();
    expect(signup.body.accessToken).toEqual(expect.any(String));

    const duplicate = await request(server).post('/auth/signup').send({
      name: 'Asha',
      email: 'asha@example.com',
      mobile: '9876543211',
      password: 'secret1',
    });
    expect(duplicate.status).toBe(409);

    const invalid = await request(server).post('/auth/signup').send({
      name: 'Asha',
      email: 'not-an-email',
      mobile: '12',
      password: 'x',
      extra: true,
    });
    expect(invalid.status).toBe(400);

    const badLogin = await request(server).post('/auth/login').send({
      identifier: 'asha@example.com',
      password: 'wrong-password',
    });
    expect(badLogin.status).toBe(401);

    const login = await request(server).post('/auth/login').send({
      identifier: '9876543210',
      password: 'secret1',
    });
    expect(login.status).toBe(201);
    expect(login.body.user.email).toBe('asha@example.com');

    const forgot = await request(server)
      .post('/auth/forgot-password')
      .send({ identifier: 'asha@example.com' });
    expect(forgot.status).toBe(201);
    expect(forgot.body.otp).toBe('4444');

    const badOtp = await request(server).post('/auth/verify-otp').send({
      identifier: 'asha@example.com',
      otp: '0000',
    });
    expect(badOtp.status).toBe(400);

    const verified = await request(server).post('/auth/verify-otp').send({
      identifier: 'asha@example.com',
      otp: forgot.body.otp,
    });
    expect(verified.status).toBe(201);
    expect(verified.body.resetToken).toEqual(expect.any(String));

    const reset = await request(server).post('/auth/reset-password').send({
      resetToken: verified.body.resetToken,
      password: 'secret2',
    });
    expect(reset.status).toBe(201);

    const replay = await request(server).post('/auth/reset-password').send({
      resetToken: verified.body.resetToken,
      password: 'secret3',
    });
    expect(replay.status).toBe(401);

    const newLogin = await request(server).post('/auth/login').send({
      identifier: 'asha@example.com',
      password: 'secret2',
    });
    expect(newLogin.status).toBe(201);
  });

  it('stores functions for the signed-in account', async () => {
    const server = app.getHttpServer();
    const signup = await request(server).post('/auth/signup').send({
      name: 'Meena',
      email: 'meena@example.com',
      mobile: '9876543212',
      password: 'secret1',
    });
    const token = signup.body.accessToken as string;

    const missing = await request(server).get('/functions');
    expect(missing.status).toBe(401);

    const created = await request(server)
      .post('/functions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: "Priya's Wedding",
        functionType: 'Wedding',
        date: '2026-12-01',
        time: '6:00 PM',
        location: 'Chennai',
        hostName: 'Priya',
        notes: 'Marriage hall',
      });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      name: "Priya's Wedding",
      functionType: 'Wedding',
      date: '2026-12-01',
      time: '6:00 PM',
      location: 'Chennai',
      hostName: 'Priya',
      notes: 'Marriage hall',
    });
    expect(created.body.id).toEqual(expect.any(String));
    expect(created.body.userId).toBeUndefined();

    const list = await request(server).get('/functions').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);

    const invalid = await request(server)
      .post('/functions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Bad date',
        functionType: 'Birthday',
        date: '2026-02-31',
        location: 'Chennai',
      });
    expect(invalid.status).toBe(400);
  });

  it('stores moi for the signed-in account', async () => {
    const server = app.getHttpServer();
    const signup = await request(server).post('/auth/signup').send({
      name: 'Ravi',
      email: 'ravi@example.com',
      mobile: '9876543213',
      password: 'secret1',
    });
    const token = signup.body.accessToken as string;

    const missing = await request(server).get('/moi');
    expect(missing.status).toBe(401);

    const created = await request(server)
      .post('/moi')
      .set('Authorization', `Bearer ${token}`)
      .send({
        personName: 'Priya',
        relation: 'Friend',
        functionType: 'Wedding',
        functionName: "Priya's Wedding",
        location: 'Chennai',
        paymentMethod: 'Cash',
        amount: 5000,
        date: '2026-12-01',
        type: 'given',
        notes: 'Given at the hall',
      });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      personName: 'Priya',
      relation: 'Friend',
      functionType: 'Wedding',
      functionName: "Priya's Wedding",
      location: 'Chennai',
      paymentMethod: 'Cash',
      amount: 5000,
      date: '2026-12-01',
      type: 'given',
      notes: 'Given at the hall',
    });
    expect(created.body.id).toEqual(expect.any(String));
    expect(created.body.userId).toBeUndefined();

    const list = await request(server).get('/moi').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);

    const other = await request(server).post('/auth/signup').send({
      name: 'Kiran',
      email: 'kiran@example.com',
      mobile: '9876543214',
      password: 'secret1',
    });
    const hidden = await request(server)
      .get('/moi')
      .set('Authorization', `Bearer ${other.body.accessToken}`);
    expect(hidden.status).toBe(200);
    expect(hidden.body).toHaveLength(0);
  });
});
