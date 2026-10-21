import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { FunctionEvent, FunctionSchema } from './function.schema';
import { FunctionsController } from './functions.controller';
import { FunctionsService } from './functions.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: FunctionEvent.name, schema: FunctionSchema },
    ]),
  ],
  controllers: [FunctionsController],
  providers: [FunctionsService],
})
export class FunctionsModule {}
