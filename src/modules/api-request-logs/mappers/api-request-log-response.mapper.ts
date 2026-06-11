/**
 * API Request Log Response Mapper
 *
 * Maps DB record to client response shape.
 */

import type { ApiRequestLog } from '@prisma/client';

export interface ApiRequestLogUser {
  id: string | null;
  email: string | null;
  roleId: string | null;
}

export interface ApiRequestLogClient {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface ApiRequestLogError {
  code: string | null;
  message: string | null;
}

export interface ApiRequestLogResponse {
  id: string;
  requestId: string | null;
  method: string;
  path: string;
  route: string | null;
  statusCode: number;
  durationMs: number;
  outcome: string;
  user: ApiRequestLogUser;
  client: ApiRequestLogClient;
  error: ApiRequestLogError;
  createdAt: string;
}

export function toApiRequestLogResponse(log: ApiRequestLog): ApiRequestLogResponse {
  return {
    id: log.id,
    requestId: log.requestId,
    method: log.method,
    path: log.path,
    route: log.route,
    statusCode: log.statusCode,
    durationMs: log.durationMs,
    outcome: log.outcome,
    user: {
      id: log.actorId,
      email: log.userEmail,
      roleId: log.userRoleId,
    },
    client: {
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
    },
    error: {
      code: log.errorCode,
      message: log.errorMessage,
    },
    createdAt: log.createdAt.toISOString(),
  };
}