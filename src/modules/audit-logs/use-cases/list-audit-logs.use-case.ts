import { Injectable } from '@nestjs/common';
import { AuditLogsRepository } from '../repositories/audit-logs.repository';
import { ListAuditLogsQueryDto, ListAuditLogsResponseDto } from '../dto/list-audit-logs.dto';

@Injectable()
export class ListAuditLogsUseCase {
  constructor(private readonly auditLogsRepository: AuditLogsRepository) {}

  async execute(query: ListAuditLogsQueryDto): Promise<ListAuditLogsResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const { data, total } = await this.auditLogsRepository.findAll({
      userId: query.userId,
      action: query.action,
      entityType: query.entityType,
      entityId: query.entityId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      page,
      limit,
    });

    return {
      data: data.map((log) => ({
        id: log.id,
        userId: log.userId,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: log.metadata as Record<string, unknown> | null,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
