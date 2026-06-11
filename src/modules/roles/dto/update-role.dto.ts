import { IsOptional, IsString, MaxLength, IsArray, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'Senior Content Manager', description: 'New role display name — max 100 characters', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description for this role', description: 'New role description — max 500 characters', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    example: ['f47ac10b-58cc-4372-a567-0e02b2c3d479'],
    description: 'New set of permission IDs to assign to this role',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds?: string[];
}
