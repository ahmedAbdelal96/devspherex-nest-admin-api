import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyPasswordRecoveryOtpDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email address of the account', maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: '123456', description: 'One-time password — 4 to 10 digits', minLength: 4, maxLength: 10 })
  @IsString()
  @Length(4, 10)
  @Matches(/^[0-9]+$/, { message: 'OTP must contain digits only' })
  otp: string;
}
