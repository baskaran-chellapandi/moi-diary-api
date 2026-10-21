import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SignupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @Matches(/^[0-9+\s-]{10,20}$/)
  mobile: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;
}

export class LoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(254)
  identifier: string;

  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string;
}

export class ForgotPasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(254)
  identifier: string;
}

export class VerifyOtpDto {
  @IsString()
  @MinLength(1)
  identifier: string;

  @IsString()
  @Matches(/^\d{4}$/)
  otp: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  currentPassword: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  newPassword: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(1)
  resetToken: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;
}
