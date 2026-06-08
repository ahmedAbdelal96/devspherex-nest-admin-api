import { Injectable } from '@nestjs/common';
import { AuditLogsRepository } from '../repositories/audit-logs.repository';
import { CreateAuditLogDto } from '../dto/create-audit-log.dto';

@Injectable()
export class CreateAuditLogUseCase {
  constructor(private readonly auditLogsRepository: AuditLogsRepository) {}

  async execute(dto: CreateAuditLogDto) {
    return this.auditLogsRepository.create({
      userId: dto.userId,
      action: dto.action,
      entityType: dto.entityType,
      entityId: dto.entityId,
      metadata: dto.metadata,
      ipAddress: dto.ipAddress,
      userAgent: dto.userAgent,
    });
  }
}
