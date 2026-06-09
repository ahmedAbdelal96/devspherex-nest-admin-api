import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListPermissionsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  group?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 50;
}

export class ListPermissionsResponseDto {
  data: Array<{
    id: string;
    key: string;
    resource: string;
    action: string;
    label: string;
    description: string | null;
    group: string;
    isSystem: boolean;
    createdAt: Date;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
