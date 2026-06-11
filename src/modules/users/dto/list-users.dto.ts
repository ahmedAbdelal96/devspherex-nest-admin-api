import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';

export class ListUsersQueryDto {
  @ApiPropertyOptional({ example: 'john', description: 'Search by name or email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'ACTIVE', enum: UserStatus, description: 'Filter by user status' })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', description: 'Filter by role ID' })
  @IsOptional()
  @IsString()
  roleId?: string;

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

export class PaginatedUsersResponseDto {
  data: Array<{
    id: string;
    email: string;
    name: string;
    status: UserStatus;
    role: {
      id: string;
      name: string;
    } | null;
    createdAt: Date;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
