/**
 * Audit Log Service
 *
 * High-level service for creating audit log records.
 * All audit logging in use-cases should go through this service, not directly
 * to the repository.
 *
 * Behavior:
 * - Sanitizes before/after/metadata before passing to repository
 * - Does NOT throw if audit log DB insert fails — logs a warning instead
 * - Audit logging failure does NOT break the originating business operation
 * - Captures actor, request context, and resource information
 *
 * Usage in use-cases (after successful state change):
 *
 *   await auditLogService.log({
 *     action: AUDIT_ACTIONS.USERS_CREATE,
 *     resourceType: AUDIT_RESOURCE_TYPES.USER,
 *     resourceId: user.id,
 *     status: 'SUCCESS',
 *     actor: { id: currentUser.id, email: currentUser.email },
 *     request: { requestId, ipAddress, userAgent },
 *     after: sanitizeAuditData(createdUser),
 *   });
 */

import { Injectable, Logger } from '@nestjs/common';
import { AuditLogsRepository } from '../repositories/audit-logs.repository';
import { sanitizeAuditData } from './audit-log-sanitizer.service';
import type { AuditAction } from '../constants/audit-actions';
import type { AuditResourceType } from '../constants/audit-resource-types';

export interface AuditActor {
  id?: string;
  email?: string;
  roleId?: string;
}

export interface AuditRequestContext {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateAuditLogInput {
  action: AuditAction | string;
  resourceType?: AuditResourceType | string;
  resourceId?: string;
  status?: 'SUCCESS' | 'FAILURE';
  actor?: AuditActor;
  request?: AuditRequestContext;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly auditLogsRepository: AuditLogsRepository) {}

  /**
   * Create a sanitized audit log record.
   *
   * If the DB insert fails, a warning is logged but the error is NOT re-thrown.
   * This ensures audit logging never breaks a critical business operation.
   */
  async log(input: CreateAuditLogInput): Promise<void> {
    try {
      const sanitizedBefore = input.before !== undefined
        ? sanitizeAuditData(input.before)
        : undefined;
      const sanitizedAfter = input.after !== undefined
        ? sanitizeAuditData(input.after)
        : undefined;
      const sanitizedMetadata = input.metadata !== undefined
        ? sanitizeAuditData(input.metadata)
        : undefined;

      await this.auditLogsRepository.create({
        actorId: input.actor?.id,
        action: input.action,
        entity: input.resourceType,
        entityId: input.resourceId,
        metadata: (sanitizedMetadata ?? sanitizedAfter ?? sanitizedBefore) as Record<string, unknown>,
        ip: input.request?.ipAddress,
        userAgent: input.request?.userAgent,
        requestId: input.request?.requestId,
      });
    } catch (err) {
      // Never let audit logging failure break the business operation
      this.logger.warn(
        `Failed to write audit log [${input.action}]: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
