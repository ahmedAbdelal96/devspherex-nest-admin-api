import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'Str0ng!Pass', description: 'Current password — 8 to 50 characters', minLength: 8, maxLength: 50 })
  @IsString()
  @MinLength(8)
  @MaxLength(50)
  currentPassword: string;

  @ApiProperty({ example: 'N3wStr0ng!Pass', description: 'New password — 8 to 50 characters', minLength: 8, maxLength: 50 })
  @IsString()
  @MinLength(8)
  @MaxLength(50)
  newPassword: string;
}
