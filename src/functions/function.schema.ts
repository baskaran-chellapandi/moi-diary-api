import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FunctionDocument = HydratedDocument<FunctionEvent>;

@Schema({
  collection: 'functions',
  timestamps: true,
})
export class FunctionEvent {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  functionType: string;

  @Prop({ required: true })
  date: string;

  @Prop({ trim: true })
  time?: string;

  @Prop({ required: true, trim: true })
  location: string;

  @Prop({ trim: true })
  hostName?: string;

  @Prop({ trim: true })
  notes?: string;
}

export const FunctionSchema = SchemaFactory.createForClass(FunctionEvent);

FunctionSchema.index({ userId: 1, date: -1 });
