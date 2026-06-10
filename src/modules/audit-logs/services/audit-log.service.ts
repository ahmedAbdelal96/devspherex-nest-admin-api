/**
 * Audit Log Service
 *
 * High-level service for creating audit log records.
 * All audit logging in use-cases should go through this service, not directly
 * to the repository.
 *
 * Behavior:
 * - Sanitizes before/after/metadata separately before passing to repository
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
 *     actor: { id: currentUser.id, email: currentUser.email, roleId: currentUser.roleId },
 *     request: { requestId, ipAddress, userAgent },
 *     before: beforeSnapshot,
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
   *
   * before, after, and metadata are sanitized separately and stored in their
   * own DB fields.
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
        actorEmail: input.actor?.email,
        actorRoleId: input.actor?.roleId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        status: input.status ?? 'SUCCESS',
        requestId: input.request?.requestId,
        ipAddress: input.request?.ipAddress,
        userAgent: input.request?.userAgent,
        before: sanitizedBefore as Record<string, unknown>,
        after: sanitizedAfter as Record<string, unknown>,
        metadata: sanitizedMetadata as Record<string, unknown>,
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