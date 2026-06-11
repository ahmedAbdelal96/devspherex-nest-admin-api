import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListRolesQueryDto {
  @ApiPropertyOptional({ example: 'content', description: 'Search by role name or slug' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 1, description: 'Page number — minimum 1', minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, description: 'Items per page — minimum 1, maximum 50', minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

export class PaginatedRolesResponseDto {
  data: Array<{
    id: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    createdAt: Date;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
