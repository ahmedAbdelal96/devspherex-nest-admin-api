/**
 * List API Request Logs Use Case
 */

import { Injectable } from '@nestjs/common';
import { ApiRequestLogsRepository } from '../repositories/api-request-logs.repository';
import { ListApiRequestLogsQueryDto } from '../dto/list-api-request-logs-query.dto';

@Injectable()
export class ListApiRequestLogsUseCase {
  constructor(private readonly apiRequestLogsRepository: ApiRequestLogsRepository) {}

  async execute(query: ListApiRequestLogsQueryDto) {
    const result = await this.apiRequestLogsRepository.findAll({
      requestId: query.requestId,
      method: query.method,
      path: query.path,
      route: query.route,
      statusCode: query.statusCode,
      outcome: query.outcome,
      userId: query.userId,
      errorCode: query.errorCode,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      minDurationMs: query.minDurationMs,
      maxDurationMs: query.maxDurationMs,
      page: query.page,
      limit: query.limit,
    });

    return {
      items: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }
}