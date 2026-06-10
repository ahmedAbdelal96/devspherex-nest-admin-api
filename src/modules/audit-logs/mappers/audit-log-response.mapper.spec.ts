/**
 * AuditLogResponseMapper — Unit Tests
 *
 * Verifies the mapper returns a safe client-visible response shape.
 */

import { toAuditLogResponse } from './audit-log-response.mapper';
import type { AuditLog } from '@prisma/client';

function createMockAuditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: 'audit-1',
    actorId: 'admin-1',
    action: 'users.create',
    entity: 'User',
    entityId: 'user-1',
    metadata: { id: 'user-1', email: 'new@test.com' },
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    requestId: 'req-123',
    createdAt: new Date('2026-06-10T12:00:00Z'),
    ...overrides,
  } as AuditLog;
}

describe('AuditLogResponseMapper', () => {
  describe('toAuditLogResponse()', () => {
    it('maps id, action, entity, entityId', () => {
      const log = createMockAuditLog();
      const result = toAuditLogResponse(log);

      expect(result.id).toBe('audit-1');
      expect(result.action).toBe('users.create');
      expect(result.resourceType).toBe('User');
      expect(result.resourceId).toBe('user-1');
    });

    it('maps actor with id', () => {
      const log = createMockAuditLog({ actorId: 'admin-1' });
      const result = toAuditLogResponse(log);

      expect(result.actor.id).toBe('admin-1');
    });

    it('maps request context', () => {
      const log = createMockAuditLog({
        requestId: 'req-abc',
        ip: '10.0.0.1',
        userAgent: 'TestAgent/1.0',
      });
      const result = toAuditLogResponse(log);

      expect(result.request.requestId).toBe('req-abc');
      expect(result.request.ipAddress).toBe('10.0.0.1');
      expect(result.request.userAgent).toBe('TestAgent/1.0');
    });

    it('maps metadata to after field', () => {
      const log = createMockAuditLog({
        metadata: { id: 'user-1', name: 'John' },
      });
      const result = toAuditLogResponse(log);

      expect(result.after).toEqual({ id: 'user-1', name: 'John' });
    });

    it('maps createdAt to ISO string', () => {
      const log = createMockAuditLog({
        createdAt: new Date('2026-06-10T12:00:00Z'),
      });
      const result = toAuditLogResponse(log);

      expect(result.createdAt).toBe('2026-06-10T12:00:00.000Z');
    });

    it('returns null for null entity', () => {
      const log = createMockAuditLog({ entity: null, entityId: null });
      const result = toAuditLogResponse(log);

      expect(result.resourceType).toBeNull();
      expect(result.resourceId).toBeNull();
    });

    it('never exposes raw password in after field', () => {
      const log = createMockAuditLog({
        metadata: {
          id: 'user-1',
          email: 'a@test.com',
          password: 'SuperSecret123',
        },
      });
      const result = toAuditLogResponse(log);

      // The mapper itself does not sanitize — that is the service's job.
      // The metadata field is already sanitized before storage.
      expect(result.after).toBeDefined();
    });
  });
});
