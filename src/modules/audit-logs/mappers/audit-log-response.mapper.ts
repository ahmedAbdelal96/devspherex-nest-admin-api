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
 * The actor info is minimal — only id is stored in DB (email/roleId would
 * require a join). For now, actor.email and actor.roleId are null.
 * The metadata field holds the sanitized before/after snapshot.
 */
export function toAuditLogResponse(log: AuditLog): AuditLogResponse {
  return {
    id: log.id,
    action: log.action,
    resourceType: log.entity,
    resourceId: log.entityId,
    status: 'SUCCESS', // existing model doesn't store status; default to SUCCESS
    actor: {
      id: log.actorId,
      email: null,
      roleId: null,
    },
    request: {
      requestId: log.requestId,
      ipAddress: log.ip,
      userAgent: log.userAgent,
    },
    // Metadata field contains the sanitized before/after snapshot
    before: null,
    after: (log.metadata as Record<string, unknown>) ?? null,
    metadata: null,
    createdAt: log.createdAt.toISOString(),
  };
}
