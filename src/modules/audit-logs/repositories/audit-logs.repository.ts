import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { AuditLog, Prisma } from '@prisma/client';

@Injectable()
export class AuditLogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    actorId?: string;
    action: string;
    entity?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
    requestId?: string;
  }): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        actorId: data.actorId ?? null,
        action: data.action,
        entity: data.entity ?? null,
        entityId: data.entityId ?? null,
        metadata:
          data.metadata !== undefined
            ? (data.metadata as Prisma.InputJsonValue)
            : undefined,
        ip: data.ip ?? null,
        userAgent: data.userAgent ?? null,
        requestId: data.requestId ?? null,
      },
    });
  }

  async findAll(params: {
    actorId?: string;
    action?: string;
    entity?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
    page: number;
    limit: number;
  }): Promise<{ data: AuditLog[]; total: number }> {
    const {
      actorId,
      action,
      entity,
      entityId,
      startDate,
      endDate,
      page,
      limit,
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

    if (actorId) {
      where.actorId = actorId;
    }

    if (action) {
      where.action = action;
    }

    if (entity) {
      where.entity = entity;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string): Promise<AuditLog | null> {
    return this.prisma.auditLog.findUnique({
      where: { id },
    });
  }
}
