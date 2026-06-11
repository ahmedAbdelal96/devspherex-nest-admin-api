/**
 * API Request Logs Repository
 *
 * DB access for api_request_logs table.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';

export type CreateApiRequestLogData = {
  requestId?: string;
  actorId?: string;
  userEmail?: string;
  userRoleId?: string;
  method: string;
  path: string;
  route?: string;
  statusCode: number;
  durationMs: number;
  outcome: 'SUCCESS' | 'FAILURE';
  ipAddress?: string;
  userAgent?: string;
  errorCode?: string;
  errorMessage?: string;
};

export type FindAllApiRequestLogsParams = {
  requestId?: string;
  method?: string;
  path?: string;
  route?: string;
  statusCode?: number;
  outcome?: string;
  userId?: string;
  errorCode?: string;
  from?: Date;
  to?: Date;
  minDurationMs?: number;
  maxDurationMs?: number;
  page?: number;
  limit?: number;
};

@Injectable()
export class ApiRequestLogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateApiRequestLogData): Promise<{ id: string }> {
    const result = await this.prisma.apiRequestLog.create({
      data: {
        requestId: data.requestId || null,
        actorId: data.actorId || null,
        userEmail: data.userEmail || null,
        userRoleId: data.userRoleId || null,
        method: data.method,
        path: data.path,
        route: data.route || null,
        statusCode: data.statusCode,
        durationMs: data.durationMs,
        outcome: data.outcome,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        errorCode: data.errorCode || null,
        errorMessage: data.errorMessage || null,
      },
      select: { id: true },
    });
    return { id: result.id };
  }

  async findAll(params: FindAllApiRequestLogsParams) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (params.requestId) {
      where['requestId'] = params.requestId;
    }
    if (params.method) {
      where['method'] = params.method;
    }
    if (params.path) {
      where['path'] = { contains: params.path, mode: 'insensitive' };
    }
    if (params.route) {
      where['route'] = { contains: params.route, mode: 'insensitive' };
    }
    if (params.statusCode) {
      where['statusCode'] = params.statusCode;
    }
    if (params.outcome) {
      where['outcome'] = params.outcome;
    }
    if (params.userId) {
      where['actorId'] = params.userId;
    }
    if (params.errorCode) {
      where['errorCode'] = params.errorCode;
    }
    if (params.from || params.to) {
      where['createdAt'] = {};
      if (params.from) {
        (where['createdAt'] as Record<string, unknown>)['gte'] = params.from;
      }
      if (params.to) {
        (where['createdAt'] as Record<string, unknown>)['lte'] = params.to;
      }
    }
    if (params.minDurationMs !== undefined || params.maxDurationMs !== undefined) {
      where['durationMs'] = {};
      if (params.minDurationMs !== undefined) {
        (where['durationMs'] as Record<string, unknown>)['gte'] = params.minDurationMs;
      }
      if (params.maxDurationMs !== undefined) {
        (where['durationMs'] as Record<string, unknown>)['lte'] = params.maxDurationMs;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.apiRequestLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.apiRequestLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string) {
    return this.prisma.apiRequestLog.findUnique({ where: { id } });
  }
}