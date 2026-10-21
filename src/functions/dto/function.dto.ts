import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const FUNCTION_TYPES = [
  'Wedding',
  'Housewarming',
  'Engagement',
  'Baby Shower',
  'Naming Ceremony',
  'Birthday',
  'Festival Get Together',
  'Reception',
  'Other',
] as const;

function emptyToUndefined(value: unknown) {
  if (value == null) return undefined;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export class CreateFunctionDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsIn(FUNCTION_TYPES)
  functionType: (typeof FUNCTION_TYPES)[number];

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @Transform(({ value }) => emptyToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(20)
  time?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  location: string;

  @Transform(({ value }) => emptyToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(80)
  hostName?: string;

  @Transform(({ value }) => emptyToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;
}
