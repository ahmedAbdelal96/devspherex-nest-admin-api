import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { AuditLog, Prisma } from '@prisma/client';

@Injectable()
export class AuditLogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    userId?: string;
    action: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        userId: data.userId ?? null,
        action: data.action,
        entityType: data.entityType ?? null,
        entityId: data.entityId ?? null,
        metadata: data.metadata !== undefined ? (data.metadata as Prisma.InputJsonValue) : undefined,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
      },
    });
  }

  async findAll(params: {
    userId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
    page: number;
    limit: number;
  }): Promise<{ data: AuditLog[]; total: number }> {
    const { userId, action, entityType, entityId, startDate, endDate, page, limit } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

    if (userId) {
      where.userId = userId;
    }

    if (action) {
      where.action = action;
    }

    if (entityType) {
      where.entityType = entityType;
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