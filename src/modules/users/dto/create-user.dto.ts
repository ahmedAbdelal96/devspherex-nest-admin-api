import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(50)
  password: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  roleId?: string;
}

export class CreateUserResponseDto {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  role: {
    id: string;
    name: string;
  } | null;
  createdAt: Date;
}
