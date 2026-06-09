import { Injectable } from '@nestjs/common';
import { AuditLogsRepository } from '../repositories/audit-logs.repository';
import { CreateAuditLogDto } from '../dto/create-audit-log.dto';

@Injectable()
export class CreateAuditLogUseCase {
  constructor(private readonly auditLogsRepository: AuditLogsRepository) {}

  async execute(dto: CreateAuditLogDto) {
    return this.auditLogsRepository.create({
      actorId: dto.actorId,
      action: dto.action,
      entity: dto.entity,
      entityId: dto.entityId,
      metadata: dto.metadata,
      ip: dto.ip,
      userAgent: dto.userAgent,
      requestId: dto.requestId,
    });
  }
}
