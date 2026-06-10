import { Injectable } from '@nestjs/common';
import { AuditLogsRepository } from '../repositories/audit-logs.repository';
import { ListAuditLogsQueryDto } from '../dto/list-audit-logs.dto';
import { toAuditLogResponse, AuditLogResponse } from '../mappers/audit-log-response.mapper';

export interface ListAuditLogsResponseDto {
  items: AuditLogResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class ListAuditLogsUseCase {
  constructor(private readonly auditLogsRepository: AuditLogsRepository) {}

  async execute(query: ListAuditLogsQueryDto): Promise<ListAuditLogsResponseDto> {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);

    const { data, total } = await this.auditLogsRepository.findAll({
      actorId: query.actorId,
      action: query.action,
      entity: query.entity,
      entityId: query.entityId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      page,
      limit,
    });

    return {
      items: data.map(toAuditLogResponse),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
