import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'newuser@example.com', description: 'Unique email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Str0ng!Pass', description: 'Password — 8 to 50 characters', minLength: 8, maxLength: 50 })
  @IsString()
  @MinLength(8)
  @MaxLength(50)
  password: string;

  @ApiProperty({ example: 'New User', description: 'Full name — 1 to 100 characters', minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', description: 'Optional role ID to assign' })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  roleId?: string;
}

export class CreateUserResponseDto {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  id: string;

  @ApiProperty({ example: 'newuser@example.com' })
  email: string;

  @ApiProperty({ example: 'New User' })
  name: string;

  @ApiProperty({ example: 'ACTIVE', enum: UserStatus })
  status: UserStatus;

  @ApiPropertyOptional({ description: 'Assigned role', properties: { id: { type: 'string' }, name: { type: 'string' } } })
  role: {
    id: string;
    name: string;
  } | null;

  @ApiProperty({ example: '2026-06-10T12:00:00.000Z' })
  createdAt: Date;
}
