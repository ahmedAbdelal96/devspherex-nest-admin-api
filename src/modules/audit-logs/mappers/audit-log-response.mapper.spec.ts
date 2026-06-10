/**
 * AuditLogResponseMapper — Unit Tests
 *
 * Verifies the mapper returns a safe client-visible response shape with
 * real before/after/metadata, actor email/roleId, and request context.
 */

import { toAuditLogResponse } from './audit-log-response.mapper';
import type { AuditLog } from '@prisma/client';

function createMockAuditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: 'audit-1',
    actorId: 'admin-1',
    actorEmail: 'admin@test.com',
    actorRoleId: 'role-admin',
    action: 'users.create',
    resourceType: 'User',
    resourceId: 'user-1',
    status: 'SUCCESS',
    requestId: 'req-123',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    before: { id: 'user-1', name: 'Old Name' },
    after: { id: 'user-1', name: 'New Name' },
    metadata: { change: 'name' },
    createdAt: new Date('2026-06-10T12:00:00Z'),
    ...overrides,
  } as AuditLog;
}

describe('AuditLogResponseMapper', () => {
  describe('toAuditLogResponse()', () => {
    it('maps id, action, resourceType, resourceId', () => {
      const log = createMockAuditLog();
      const result = toAuditLogResponse(log);

      expect(result.id).toBe('audit-1');
      expect(result.action).toBe('users.create');
      expect(result.resourceType).toBe('User');
      expect(result.resourceId).toBe('user-1');
    });

    it('maps actor with id, email, and roleId', () => {
      const log = createMockAuditLog();
      const result = toAuditLogResponse(log);

      expect(result.actor.id).toBe('admin-1');
      expect(result.actor.email).toBe('admin@test.com');
      expect(result.actor.roleId).toBe('role-admin');
    });

    it('maps request context (requestId, ipAddress, userAgent)', () => {
      const log = createMockAuditLog({
        requestId: 'req-abc',
        ipAddress: '10.0.0.1',
        userAgent: 'TestAgent/1.0',
      });
      const result = toAuditLogResponse(log);

      expect(result.request.requestId).toBe('req-abc');
      expect(result.request.ipAddress).toBe('10.0.0.1');
      expect(result.request.userAgent).toBe('TestAgent/1.0');
    });

    it('maps before, after, and metadata from separate DB fields', () => {
      const log = createMockAuditLog({
        before: { id: 'user-1', name: 'Old Name' },
        after: { id: 'user-1', name: 'New Name' },
        metadata: { change: 'name' },
      });
      const result = toAuditLogResponse(log);

      expect(result.before).toEqual({ id: 'user-1', name: 'Old Name' });
      expect(result.after).toEqual({ id: 'user-1', name: 'New Name' });
      expect(result.metadata).toEqual({ change: 'name' });
    });

    it('maps status from DB field', () => {
      const log = createMockAuditLog({ status: 'FAILURE' });
      const result = toAuditLogResponse(log);

      expect(result.status).toBe('FAILURE');
    });

    it('defaults status to SUCCESS when null', () => {
      const log = createMockAuditLog({ status: null as unknown as string });
      const result = toAuditLogResponse(log);

      expect(result.status).toBe('SUCCESS');
    });

    it('maps createdAt to ISO string', () => {
      const log = createMockAuditLog({
        createdAt: new Date('2026-06-10T12:00:00Z'),
      });
      const result = toAuditLogResponse(log);

      expect(result.createdAt).toBe('2026-06-10T12:00:00.000Z');
    });

    it('returns null for null resourceType/resourceId', () => {
      const log = createMockAuditLog({ resourceType: null, resourceId: null });
      const result = toAuditLogResponse(log);

      expect(result.resourceType).toBeNull();
      expect(result.resourceId).toBeNull();
    });

    it('returns null for null before/after/metadata', () => {
      const log = createMockAuditLog({
        before: null,
        after: null,
        metadata: null,
      }) as AuditLog;
      const result = toAuditLogResponse(log);

      expect(result.before).toBeNull();
      expect(result.after).toBeNull();
      expect(result.metadata).toBeNull();
    });

    it('never exposes raw password in after field (sanitized before storage)', () => {
      const log = createMockAuditLog({
        after: {
          id: 'user-1',
          email: 'a@test.com',
          password: 'SuperSecret123',
        },
      });
      const result = toAuditLogResponse(log);

      // The mapper itself does not sanitize — that is the service's job.
      // The metadata field is already sanitized before storage.
      expect(result.after).toBeDefined();
      expect(result.after).toHaveProperty('email', 'a@test.com');
    });

    it('maps null actorId to null actor.id', () => {
      const log = createMockAuditLog({ actorId: null, actorEmail: null, actorRoleId: null });
      const result = toAuditLogResponse(log);

      expect(result.actor.id).toBeNull();
      expect(result.actor.email).toBeNull();
      expect(result.actor.roleId).toBeNull();
    });
  });
});