/**
 * Audit Context Extraction — Unit Tests
 *
 * Verifies:
 * - requestId extracted from req.requestId
 * - ipAddress from req.ip or x-forwarded-for first value
 * - userAgent extracted from user-agent header
 * - actor id/email/roleId extracted from user object
 * - Authorization/cookies/body are never included
 */

import { getAuditRequestContext, getAuditActorFromUser } from './audit-context.util';

describe('AuditContextUtil', () => {
  describe('getAuditRequestContext()', () => {
    it('extracts requestId from req.requestId', () => {
      const req = {
        requestId: 'req-abc-123',
        ip: '192.168.1.1',
        headers: {},
      } as unknown as import('express').Request;

      const ctx = getAuditRequestContext(req);
      expect(ctx.requestId).toBe('req-abc-123');
    });

    it('extracts ipAddress from req.ip', () => {
      const req = {
        requestId: 'req-1',
        ip: '10.0.0.5',
        headers: {},
      } as unknown as import('express').Request;

      const ctx = getAuditRequestContext(req);
      expect(ctx.ipAddress).toBe('10.0.0.5');
    });

    it('extracts first value from x-forwarded-for', () => {
      const req = {
        requestId: 'req-1',
        ip: '127.0.0.1',
        headers: {
          'x-forwarded-for': '203.0.113.50, 70.41.3.18, 150.172.238.178',
        },
      } as unknown as import('express').Request;

      const ctx = getAuditRequestContext(req);
      expect(ctx.ipAddress).toBe('203.0.113.50');
    });

    it('uses only first x-forwarded-for when array', () => {
      const req = {
        requestId: 'req-1',
        ip: '127.0.0.1',
        headers: {
          'x-forwarded-for': ['203.0.113.50', '70.41.3.18'],
        },
      } as unknown as import('express').Request;

      const ctx = getAuditRequestContext(req);
      expect(ctx.ipAddress).toBe('203.0.113.50');
    });

    it('falls back to req.ip when x-forwarded-for is absent', () => {
      const req = {
        requestId: 'req-1',
        ip: '172.16.0.1',
        headers: {},
      } as unknown as import('express').Request;

      const ctx = getAuditRequestContext(req);
      expect(ctx.ipAddress).toBe('172.16.0.1');
    });

    it('extracts userAgent from user-agent header', () => {
      const req = {
        requestId: 'req-1',
        ip: '1.2.3.4',
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      } as unknown as import('express').Request;

      const ctx = getAuditRequestContext(req);
      expect(ctx.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    });

    it('uses first user-agent when array', () => {
      const req = {
        requestId: 'req-1',
        ip: '1.2.3.4',
        headers: {
          'user-agent': ['Mozilla/5.0', 'Chrome/120'],
        },
      } as unknown as import('express').Request;

      const ctx = getAuditRequestContext(req);
      expect(ctx.userAgent).toBe('Mozilla/5.0');
    });

    it('returns empty object when no request context available', () => {
      const req = {
        headers: {},
      } as unknown as import('express').Request;

      const ctx = getAuditRequestContext(req);
      expect(ctx.requestId).toBeUndefined();
      expect(ctx.ipAddress).toBeUndefined();
      expect(ctx.userAgent).toBeUndefined();
    });

    it('does NOT include authorization header', () => {
      const req = {
        requestId: 'req-1',
        ip: '1.2.3.4',
        headers: {
          'user-agent': 'Test/1.0',
          authorization: 'Bearer secret-token',
        },
      } as unknown as import('express').Request;

      const ctx = getAuditRequestContext(req);
      // authorization should NOT appear anywhere in the extracted context
      expect(JSON.stringify(ctx)).not.toContain('authorization');
      expect(JSON.stringify(ctx)).not.toContain('Bearer');
      expect(JSON.stringify(ctx)).not.toContain('secret-token');
    });
  });

  describe('getAuditActorFromUser()', () => {
    it('extracts id, email, roleId from user object', () => {
      const user = { id: 'user-1', email: 'admin@test.com', roleId: 'role-admin' };
      const actor = getAuditActorFromUser(user);

      expect(actor.id).toBe('user-1');
      expect(actor.email).toBe('admin@test.com');
      expect(actor.roleId).toBe('role-admin');
    });

    it('returns empty object for null user', () => {
      const actor = getAuditActorFromUser(null);
      expect(actor).toEqual({});
    });

    it('returns empty object for undefined user', () => {
      const actor = getAuditActorFromUser(undefined);
      expect(actor).toEqual({});
    });

    it('omits undefined fields', () => {
      const user = { id: 'user-1' } as { id?: string; email?: string; roleId?: string };
      const actor = getAuditActorFromUser(user);

      expect(actor.id).toBe('user-1');
      expect(actor.email).toBeUndefined();
      expect(actor.roleId).toBeUndefined();
    });
  });
});