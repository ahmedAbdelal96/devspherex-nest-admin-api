/**
 * API Request Log Service
 *
 * Non-blocking request observability logging.
 * Failures are logged but never thrown — API requests complete normally.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ApiRequestLogsRepository } from '../repositories/api-request-logs.repository';
import {
  MAX_PATH_LENGTH,
  MAX_USER_AGENT_LENGTH,
} from '../constants/api-request-log.constants';

export type CreateApiRequestLogInput = {
  requestId?: string;
  method: string;
  path: string;
  route?: string;
  statusCode: number;
  durationMs: number;
  outcome: 'SUCCESS' | 'FAILURE';
  user?: {
    id?: string;
    email?: string;
    roleId?: string;
  };
  ipAddress?: string;
  userAgent?: string;
  errorCode?: string;
  errorMessage?: string;
};

@Injectable()
export class ApiRequestLogService {
  private readonly logger = new Logger(ApiRequestLogService.name);

  constructor(private readonly apiRequestLogsRepository: ApiRequestLogsRepository) {}

  async log(input: CreateApiRequestLogInput): Promise<void> {
    try {
      const truncatedPath =
        input.path.length > MAX_PATH_LENGTH
          ? input.path.slice(0, MAX_PATH_LENGTH)
          : input.path;

      const truncatedUserAgent =
        input.userAgent && input.userAgent.length > MAX_USER_AGENT_LENGTH
          ? input.userAgent.slice(0, MAX_USER_AGENT_LENGTH)
          : input.userAgent;

      await this.apiRequestLogsRepository.create({
        requestId: input.requestId || undefined,
        actorId: input.user?.id || undefined,
        userEmail: input.user?.email || undefined,
        userRoleId: input.user?.roleId || undefined,
        method: input.method,
        path: truncatedPath,
        route: input.route || undefined,
        statusCode: input.statusCode,
        durationMs: input.durationMs,
        outcome: input.outcome,
        ipAddress: input.ipAddress || undefined,
        userAgent: truncatedUserAgent || undefined,
        errorCode: input.errorCode || undefined,
        errorMessage: input.errorMessage || undefined,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to write API request log [${input.method} ${input.path}]: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}