import { IsEmail, MaxLength } from 'class-validator';

export class RequestPasswordRecoveryDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}
