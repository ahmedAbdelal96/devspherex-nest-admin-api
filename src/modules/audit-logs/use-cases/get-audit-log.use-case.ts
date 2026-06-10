import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditLogsRepository } from '../repositories/audit-logs.repository';
import { toAuditLogResponse, AuditLogResponse } from '../mappers/audit-log-response.mapper';

@Injectable()
export class GetAuditLogUseCase {
  constructor(private readonly auditLogsRepository: AuditLogsRepository) {}

  async execute(id: string): Promise<AuditLogResponse> {
    const log = await this.auditLogsRepository.findById(id);

    if (!log) {
      throw new NotFoundException('Audit log not found');
    }

    return toAuditLogResponse(log);
  }
}
