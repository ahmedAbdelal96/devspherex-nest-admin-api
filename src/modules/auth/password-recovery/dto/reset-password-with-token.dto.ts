import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordWithTokenDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'Session token received after OTP verification — minimum 20 characters', minLength: 20 })
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  resetSessionToken: string;

  @ApiProperty({ example: 'N3wStr0ng!Pass', description: 'New password — 8 to 128 characters', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}
