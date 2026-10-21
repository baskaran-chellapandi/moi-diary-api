import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import * as os from 'os';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';
import { FunctionsModule } from './functions/functions.module';
import { MoiModule } from './moi/moi.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
        serverSelectionTimeoutMS: 10000,
        runtimeAdapters: { os },
      }),
    }),
    AuthModule,
    FunctionsModule,
    MoiModule,
  ],
})
export class AppModule {}
