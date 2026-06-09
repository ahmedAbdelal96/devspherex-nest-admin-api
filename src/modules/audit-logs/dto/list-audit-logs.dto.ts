import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsDateString,
} from "class-validator";
import { Type } from "class-transformer";

export class ListAuditLogsQueryDto {
  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  entity?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

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
  @Max(50)
  limit?: number = 20;
}

export class ListAuditLogsResponseDto {
  data: Array<{
    id: string;
    actorId: string | null;
    action: string;
    entity: string | null;
    entityId: string | null;
    metadata: Record<string, unknown> | null;
    ip: string | null;
    userAgent: string | null;
    requestId: string | null;
    createdAt: Date;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
