import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');

export function requestContext(
  req: Request & { id?: string },
  res: Response,
  next: NextFunction,
) {
  const header = req.header('x-request-id');
  const requestId = header && header.length <= 80 ? header : randomUUID();
  req.id = requestId;
  res.setHeader('x-request-id', requestId);

  const started = Date.now();
  res.on('finish', () => {
    logger.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms requestId=${requestId}`,
    );
  });
  next();
}
