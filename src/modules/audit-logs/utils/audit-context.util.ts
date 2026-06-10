/**
 * Audit Context Extraction Utilities
 *
 * Safe helpers to extract audit-relevant context from Express Request
 * and current user objects. Designed to be used in controllers before
 * calling AuditLogService.log().
 *
 * Rules:
 * - requestId comes from req.requestId (set by requestIdMiddleware)
 * - ipAddress comes from req.ip or x-forwarded-for first value
 * - userAgent comes from req.headers['user-agent']
 * - Never store authorization header
 * - Never store cookies
 * - Never store raw body
 */

import type { Request } from 'express';
import type { AuditActor, AuditRequestContext } from '../services/audit-log.service';

/**
 * Extract audit-safe request context from an Express Request.
 *
 * Does NOT include:
 * - Authorization header
 * - Cookie header
 * - Request body
 * - Query parameters
 */
export function getAuditRequestContext(req: Request): AuditRequestContext {
  // requestId is attached by requestIdMiddleware as a custom property
  const requestId = (req as unknown as { requestId?: string }).requestId;

  // Prefer x-forwarded-for, fall back to req.ip
  const forwardedFor = req.headers['x-forwarded-for'];
  let ipAddress: string | undefined;
  if (forwardedFor !== undefined) {
    const first = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    // x-forwarded-for is comma-separated: "client, proxy1, proxy2"
    const client = typeof first === 'string' ? first.split(',')[0].trim() : undefined;
    ipAddress = client || undefined;
  } else {
    ipAddress = req.ip as string | undefined;
  }

  const userAgentRaw = req.headers['user-agent'];
  const userAgent = Array.isArray(userAgentRaw)
    ? userAgentRaw[0]
    : (userAgentRaw as string | undefined);

  return {
    requestId: requestId || undefined,
    ipAddress: ipAddress || undefined,
    userAgent: userAgent || undefined,
  };
}

/**
 * Extract actor info from a current user object.
 *
 * The user object typically comes from JWT strategy and has id/email/roleId.
 */
export function getAuditActorFromUser(
  user: { id?: string; email?: string; roleId?: string } | null | undefined,
): AuditActor {
  if (!user) {
    return {};
  }
  return {
    id: user.id || undefined,
    email: user.email || undefined,
    roleId: user.roleId || undefined,
  };
}