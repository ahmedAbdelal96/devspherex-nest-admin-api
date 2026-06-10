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

export class ListAuditLogsQueryDto {
  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  /** @deprecated Use resourceType instead */
  @IsOptional()
  @IsString()
  entity?: string;

  /** @deprecated Use resourceId instead */
  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  resourceType?: string;

  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsString()
  requestId?: string;

  @IsOptional()
  @IsIn(['SUCCESS', 'FAILURE'])
  status?: string;

  /** Start of date range (inclusive). ISO 8601 format. */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** End of date range (inclusive). ISO 8601 format. */
  @IsOptional()
  @IsDateString()
  to?: string;

  /** @deprecated Use from instead */
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /** @deprecated Use to instead */
  @IsOptional()
  @IsDateString()
  endDate?: string;

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
  @Max(100)
  limit?: number = 20;
}