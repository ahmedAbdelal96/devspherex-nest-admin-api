import { IsOptional, IsString, IsEmail, MinLength, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'updated@example.com', description: 'New email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Updated Name', description: 'New full name — 1 to 100 characters', minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', description: 'New role ID assignment' })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  roleId?: string;
}
