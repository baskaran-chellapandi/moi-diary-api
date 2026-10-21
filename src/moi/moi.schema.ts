import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MoiDocument = HydratedDocument<MoiEntry>;

@Schema({
  collection: 'moi',
  timestamps: true,
})
export class MoiEntry {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  personName: string;

  @Prop({ required: true, trim: true })
  relation: string;

  @Prop({ required: true, trim: true })
  functionType: string;

  @Prop({ trim: true })
  functionName?: string;

  @Prop({ trim: true })
  location?: string;

  @Prop({ trim: true })
  paymentMethod?: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  date: string;

  @Prop({ required: true, enum: ['given', 'received'] })
  type: 'given' | 'received';

  @Prop({ trim: true })
  notes?: string;

  @Prop()
  returnAmount?: number;

  @Prop()
  multiplier?: number;
}

export const MoiSchema = SchemaFactory.createForClass(MoiEntry);

MoiSchema.index({ userId: 1, date: -1 });
