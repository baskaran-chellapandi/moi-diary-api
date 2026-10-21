import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateFunctionDto } from './dto/function.dto';
import { FunctionsService } from './functions.service';

@Controller('functions')
@UseGuards(JwtAuthGuard)
export class FunctionsController {
  constructor(private readonly functions: FunctionsService) {}

  @Get()
  list(@Req() request: Request & { user: { sub: string } }) {
    return this.functions.list(request.user.sub);
  }

  @Post()
  create(
    @Req() request: Request & { user: { sub: string } },
    @Body() dto: CreateFunctionDto,
  ) {
    return this.functions.create(request.user.sub, dto);
  }
}
