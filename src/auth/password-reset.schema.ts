import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PasswordResetDocument = HydratedDocument<PasswordReset>;

@Schema({
  collection: 'password_resets',
  timestamps: { createdAt: true, updatedAt: false },
})
export class PasswordReset {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  codeHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ type: Date, default: null })
  verifiedAt: Date | null;

  createdAt: Date;
}

export const PasswordResetSchema = SchemaFactory.createForClass(PasswordReset);
