import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListAuditLogsQueryDto {
  @ApiPropertyOptional({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', description: 'Filter by actor (user) ID' })
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional({ example: 'user.created', description: 'Filter by action key (e.g. user.created, role.updated)' })
  @IsOptional()
  @IsString()
  action?: string;

  /** @deprecated Use resourceType instead */
  @ApiPropertyOptional({ description: 'Deprecated — use resourceType', deprecated: true })
  @IsOptional()
  @IsString()
  entity?: string;

  /** @deprecated Use resourceId instead */
  @ApiPropertyOptional({ description: 'Deprecated — use resourceId', deprecated: true })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({ example: 'User', description: 'Filter by resource type (e.g. User, Role, Permission)' })
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiPropertyOptional({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', description: 'Filter by resource ID' })
  @IsOptional()
  @IsString()
  resourceId?: string;

  @ApiPropertyOptional({ example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6', description: 'Filter by request tracking ID' })
  @IsOptional()
  @IsString()
  requestId?: string;

  @ApiPropertyOptional({ example: 'SUCCESS', enum: ['SUCCESS', 'FAILURE'], description: 'Filter by outcome status' })
  @IsOptional()
  @IsIn(['SUCCESS', 'FAILURE'])
  status?: string;

  /** Start of date range (inclusive). ISO 8601 format. */
  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z', description: 'Filter logs from this date (inclusive) — ISO 8601 format' })
  @IsOptional()
  @IsDateString()
  from?: string;

  /** End of date range (inclusive). ISO 8601 format. */
  @ApiPropertyOptional({ example: '2026-06-30T23:59:59.999Z', description: 'Filter logs up to this date (inclusive) — ISO 8601 format' })
  @IsOptional()
  @IsDateString()
  to?: string;

  /** @deprecated Use from instead */
  @ApiPropertyOptional({ description: 'Deprecated — use from', deprecated: true })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /** @deprecated Use to instead */
  @ApiPropertyOptional({ description: 'Deprecated — use to', deprecated: true })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 1, description: 'Page number — minimum 1', minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, description: 'Items per page — minimum 1, maximum 100', minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}