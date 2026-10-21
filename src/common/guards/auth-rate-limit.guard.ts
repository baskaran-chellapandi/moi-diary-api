import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const limit = this.config.get<number>('AUTH_RATE_LIMIT') ?? 10;
    const windowMs = 60_000;
    const key = `${request.ip}:${request.method}:${request.path}`;
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter(
      (timestamp) => now - timestamp < windowMs,
    );

    if (recent.length >= limit) {
      throw new HttpException(
        'Too many attempts. Try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}
