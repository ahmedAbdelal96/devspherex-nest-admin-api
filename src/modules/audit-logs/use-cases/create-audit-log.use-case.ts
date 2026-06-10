import { Injectable } from '@nestjs/common';
import { AuditLogsRepository } from '../repositories/audit-logs.repository';
import { CreateAuditLogDto } from '../dto/create-audit-log.dto';

@Injectable()
export class CreateAuditLogUseCase {
  constructor(private readonly auditLogsRepository: AuditLogsRepository) {}

  async execute(dto: CreateAuditLogDto) {
    return this.auditLogsRepository.create({
      actorId: dto.actorId,
      actorEmail: dto.actorEmail,
      actorRoleId: dto.actorRoleId,
      action: dto.action,
      resourceType: dto.resourceType,
      resourceId: dto.resourceId,
      status: dto.status,
      requestId: dto.requestId,
      ipAddress: dto.ipAddress,
      userAgent: dto.userAgent,
      before: dto.before,
      after: dto.after,
      metadata: dto.metadata,
    });
  }
}