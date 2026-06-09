import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

export class VerifyPasswordRecoveryOtpDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @Length(4, 10)
  @Matches(/^[0-9]+$/, { message: 'OTP must contain digits only' })
  otp: string;
}
