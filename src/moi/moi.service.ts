import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateMoiDto } from './dto/moi.dto';
import { MoiDocument, MoiEntry } from './moi.schema';

function isRealDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function toMoi(doc: MoiDocument) {
  return {
    id: doc.id as string,
    personName: doc.personName,
    relation: doc.relation,
    functionType: doc.functionType,
    functionName: doc.functionName || undefined,
    location: doc.location || undefined,
    paymentMethod: doc.paymentMethod || undefined,
    amount: doc.amount,
    date: doc.date,
    type: doc.type,
    notes: doc.notes || undefined,
    returnAmount: doc.returnAmount ?? undefined,
    multiplier: doc.multiplier ?? undefined,
  };
}

@Injectable()
export class MoiService {
  constructor(
    @InjectModel(MoiEntry.name) private readonly moi: Model<MoiEntry>,
  ) {}

  async list(userId: string) {
    const rows = await this.moi
      .find({ userId })
      .sort({ date: -1, createdAt: -1 })
      .exec();
    return rows.map(toMoi);
  }

  async create(userId: string, dto: CreateMoiDto) {
    if (!isRealDate(dto.date)) {
      throw new BadRequestException('Enter a valid date.');
    }
    const created = await this.moi.create({
      userId,
      personName: dto.personName,
      relation: dto.relation,
      functionType: dto.functionType,
      functionName: dto.functionName,
      location: dto.location,
      paymentMethod: dto.paymentMethod,
      amount: dto.amount,
      date: dto.date,
      type: dto.type,
      notes: dto.notes,
      returnAmount: dto.returnAmount,
      multiplier: dto.multiplier,
    });
    return toMoi(created);
  }
}
