import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsEnum } from 'class-validator';
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
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  roleId?: string;
}

export class CreateUserResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  role: {
    id: string;
    name: string;
  } | null;
  createdAt: Date;
}
