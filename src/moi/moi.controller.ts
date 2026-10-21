import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateMoiDto } from './dto/moi.dto';
import { MoiService } from './moi.service';

@Controller('moi')
@UseGuards(JwtAuthGuard)
export class MoiController {
  constructor(private readonly moi: MoiService) {}

  @Get()
  list(@Req() request: Request & { user: { sub: string } }) {
    return this.moi.list(request.user.sub);
  }

  @Post()
  create(
    @Req() request: Request & { user: { sub: string } },
    @Body() dto: CreateMoiDto,
  ) {
    return this.moi.create(request.user.sub, dto);
  }
}
