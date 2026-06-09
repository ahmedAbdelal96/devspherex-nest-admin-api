import { IsString, IsOptional, MaxLength, IsArray, IsUUID } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(100)
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds?: string[];
}

export class CreateRoleResponseDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  permissions: Array<{
    id: string;
    key: string;
    group: string;
  }>;
  createdAt: Date;
}
