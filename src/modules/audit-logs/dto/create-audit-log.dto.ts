import { IsOptional, IsString, IsObject, IsUUID } from 'class-validator';

export class CreateAuditLogDto {
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsString()
  action: string;

  @IsOptional()
  @IsString()
  entity?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  ip?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  requestId?: string;
}
