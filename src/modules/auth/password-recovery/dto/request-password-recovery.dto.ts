import { IsEmail, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestPasswordRecoveryDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email address of the account to recover', maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  email: string;
}
