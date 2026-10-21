import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { requestContext } from './common/middleware/request-context.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const nodeEnv = config.get<string>('NODE_ENV');

  if (!config.get<boolean>('JWT_SECRET_FROM_ENV') && nodeEnv !== 'production') {
    logger.warn('JWT_SECRET is not set. Using a development-only secret.');
  }
  if (config.get<boolean>('USE_DEFAULT_OTP') && nodeEnv === 'production') {
    logger.warn('USE_DEFAULT_OTP is enabled. Password reset codes are fixed.');
  }

  const corsOrigin = config.get<string>('CORS_ORIGIN') ?? '';
  app.enableCors({
    origin:
      nodeEnv === 'production'
        ? corsOrigin
            .split(',')
            .map((origin) => origin.trim())
            .filter(Boolean)
        : true,
  });

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  app.use(requestContext);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
  logger.log(`Moi Diary API listening on port ${port}`);
}

bootstrap();
