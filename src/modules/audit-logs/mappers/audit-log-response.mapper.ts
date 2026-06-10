/**
 * Audit Log Response Mapper
 *
 * Maps raw AuditLog DB records to the safe client-visible response shape.
 * Never exposes raw internal fields directly from Prisma.
 */

import type { AuditLog } from '@prisma/client';

export interface AuditLogActor {
  id: string | null;
  email: string | null;
  roleId: string | null;
}

export interface AuditLogRequest {
  requestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AuditLogResponse {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  status: string;
  actor: AuditLogActor;
  request: AuditLogRequest;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * Map a raw AuditLog DB record to a safe client response.
 *
 * Stores: actorId/actorEmail/actorRoleId, requestId/ipAddress/userAgent,
 * resourceType/resourceId, status, before/after/metadata.
 */
export function toAuditLogResponse(log: AuditLog): AuditLogResponse {
  return {
    id: log.id,
    action: log.action,
    resourceType: log.resourceType,
    resourceId: log.resourceId,
    status: log.status ?? 'SUCCESS',
    actor: {
      id: log.actorId,
      email: log.actorEmail,
      roleId: log.actorRoleId,
    },
    request: {
      requestId: log.requestId,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
    },
    before: (log.before as Record<string, unknown>) ?? null,
    after: (log.after as Record<string, unknown>) ?? null,
    metadata: (log.metadata as Record<string, unknown>) ?? null,
    createdAt: log.createdAt.toISOString(),
  };
}