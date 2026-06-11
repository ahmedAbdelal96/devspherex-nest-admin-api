import { IsString, IsOptional, MaxLength, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ example: 'Content Manager', description: 'Role display name — unique, max 100 characters', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'content-manager', description: 'URL-safe role slug — unique, max 100 characters', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  slug: string;

  @ApiPropertyOptional({ example: 'Can manage content items, media, and categories', description: 'Role description — max 500 characters', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    example: ['f47ac10b-58cc-4372-a567-0e02b2c3d479'],
    description: 'UUID array of permission IDs to assign to this role',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds?: string[];
}

export class CreateRoleResponseDto {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  id: string;

  @ApiProperty({ example: 'Content Manager' })
  name: string;

  @ApiProperty({ example: 'content-manager' })
  slug: string;

  @ApiPropertyOptional({ example: 'Can manage content items, media, and categories' })
  description: string | null;

  @ApiProperty({ example: false, description: 'Whether this is a system role (cannot be deleted)' })
  isSystem: boolean;

  @ApiProperty({ description: 'Permissions assigned to this role', type: 'array' })
  permissions: Array<{
    id: string;
    key: string;
    group: string;
  }>;

  @ApiProperty({ example: '2026-06-10T12:00:00.000Z' })
  createdAt: Date;
}
