import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateFunctionDto } from './dto/function.dto';
import { FunctionDocument, FunctionEvent } from './function.schema';

function isRealDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function toFunction(doc: FunctionDocument) {
  return {
    id: doc.id as string,
    name: doc.name,
    functionType: doc.functionType,
    date: doc.date,
    time: doc.time ?? null,
    location: doc.location,
    hostName: doc.hostName || undefined,
    notes: doc.notes || undefined,
  };
}

@Injectable()
export class FunctionsService {
  constructor(
    @InjectModel(FunctionEvent.name)
    private readonly functions: Model<FunctionEvent>,
  ) {}

  async list(userId: string) {
    const rows = await this.functions
      .find({ userId })
      .sort({ date: -1, createdAt: -1 })
      .exec();
    return rows.map(toFunction);
  }

  async create(userId: string, dto: CreateFunctionDto) {
    if (!isRealDate(dto.date)) {
      throw new BadRequestException('Enter a valid date.');
    }
    const created = await this.functions.create({
      userId,
      name: dto.name,
      functionType: dto.functionType,
      date: dto.date,
      time: dto.time,
      location: dto.location,
      hostName: dto.hostName,
      notes: dto.notes,
    });
    return toFunction(created);
  }
}
