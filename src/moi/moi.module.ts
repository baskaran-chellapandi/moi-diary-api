import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { MoiController } from './moi.controller';
import { MoiEntry, MoiSchema } from './moi.schema';
import { MoiService } from './moi.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([{ name: MoiEntry.name, schema: MoiSchema }]),
  ],
  controllers: [MoiController],
  providers: [MoiService],
})
export class MoiModule {}
