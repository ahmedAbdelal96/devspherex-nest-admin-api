import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { AuditLog, Prisma } from '@prisma/client';

export interface CreateAuditLogData {
  actorId?: string | null;
  actorEmail?: string | null;
  actorRoleId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  status?: string;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}

export interface FindAllAuditLogsParams {
  actorId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  status?: string;
  requestId?: string;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

@Injectable()
export class AuditLogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateAuditLogData): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        actorId: data.actorId ?? null,
        actorEmail: data.actorEmail ?? null,
        actorRoleId: data.actorRoleId ?? null,
        action: data.action,
        resourceType: data.resourceType ?? null,
        resourceId: data.resourceId ?? null,
        status: data.status ?? 'SUCCESS',
        requestId: data.requestId ?? null,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
        before: data.before !== undefined ? (data.before as Prisma.InputJsonValue) : undefined,
        after: data.after !== undefined ? (data.after as Prisma.InputJsonValue) : undefined,
        metadata: data.metadata !== undefined ? (data.metadata as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  async findAll(params: FindAllAuditLogsParams): Promise<{ data: AuditLog[]; total: number }> {
    const {
      actorId,
      action,
      resourceType,
      resourceId,
      status,
      requestId,
      from,
      to,
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

    if (resourceType) {
      where.resourceType = resourceType;
    }

    if (resourceId) {
      where.resourceId = resourceId;
    }

    if (status) {
      where.status = status;
    }

    if (requestId) {
      where.requestId = requestId;
    }

    if (from || to) {
      where.createdAt = {};
      if (from) {
        where.createdAt.gte = from;
      }
      if (to) {
        where.createdAt.lte = to;
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