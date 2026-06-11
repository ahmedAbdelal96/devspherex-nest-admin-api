/**
 * List API Request Logs Query DTO
 */

import { IsOptional, IsString, IsInt, IsIn, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListApiRequestLogsQueryDto {
  @ApiPropertyOptional({ example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6', description: 'Filter by request tracking ID' })
  @IsOptional()
  @IsString()
  requestId?: string;

  @ApiPropertyOptional({ example: 'GET', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], description: 'Filter by HTTP method' })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({ example: '/users', description: 'Filter by request path (partial match)' })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional({ example: '/users/:id', description: 'Filter by route pattern (partial match)' })
  @IsOptional()
  @IsString()
  route?: string;

  @ApiPropertyOptional({ example: 200, description: 'Filter by HTTP status code' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  statusCode?: number;

  @ApiPropertyOptional({ example: 'SUCCESS', enum: ['SUCCESS', 'FAILURE'], description: 'Filter by outcome' })
  @IsOptional()
  @IsIn(['SUCCESS', 'FAILURE'])
  outcome?: string;

  @ApiPropertyOptional({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', description: 'Filter by actor (user) ID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ example: 'INTERNAL_SERVER_ERROR', description: 'Filter by error code (e.g. VALIDATION_FAILED, AUTH_UNAUTHORIZED)' })
  @IsOptional()
  @IsString()
  errorCode?: string;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z', description: 'Filter logs from this date (inclusive) — ISO 8601 format' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-06-30T23:59:59.999Z', description: 'Filter logs up to this date (inclusive) — ISO 8601 format' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ example: 100, description: 'Minimum request duration in milliseconds' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minDurationMs?: number;

  @ApiPropertyOptional({ example: 5000, description: 'Maximum request duration in milliseconds' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxDurationMs?: number;

  @ApiPropertyOptional({ example: 1, description: 'Page number — minimum 1', minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page?: number;

  @ApiPropertyOptional({ example: 20, description: 'Items per page — minimum 1, maximum 100', minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}