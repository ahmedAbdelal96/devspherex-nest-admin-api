/**
 * AuditLogService — Unit Tests
 *
 * Verifies:
 * - Creates sanitized audit log records with before/after/metadata stored separately
 * - Includes actorId/actorEmail/actorRoleId when provided
 * - Includes requestId/ipAddress/userAgent when provided
 * - Defaults status to SUCCESS
 * - Catches repository errors and does not throw
 * - Does not store raw sensitive data
 * - Does not mutate original before/after objects
 */

import { AuditLogService } from './audit-log.service';
import { AuditLogsRepository } from '../repositories/audit-logs.repository';
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '../constants';

function createMockRepository() {
  return {
    create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
  } as unknown as jest.Mocked<AuditLogsRepository>;
}

describe('AuditLogService', () => {
  let repository: jest.Mocked<AuditLogsRepository>;
  let service: AuditLogService;

  beforeEach(() => {
    repository = createMockRepository();
    service = new AuditLogService(repository);
  });

  describe('log()', () => {
    it('stores before, after, and metadata in separate fields', async () => {
      await service.log({
        action: AUDIT_ACTIONS.USERS_UPDATE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: 'user-1',
        status: 'SUCCESS',
        actor: { id: 'admin-1' },
        before: { id: 'user-1', name: 'Old Name' },
        after: { id: 'user-1', name: 'New Name' },
        metadata: { change: 'name' },
      });

      const call = repository.create.mock.calls[0][0];
      expect(call.before).toEqual({ id: 'user-1', name: 'Old Name' });
      expect(call.after).toEqual({ id: 'user-1', name: 'New Name' });
      expect(call.metadata).toEqual({ change: 'name' });
    });

    it('stores actorEmail and actorRoleId when provided', async () => {
      await service.log({
        action: AUDIT_ACTIONS.USERS_CREATE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: 'user-1',
        actor: { id: 'admin-1', email: 'admin@test.com', roleId: 'role-admin' },
      });

      const call = repository.create.mock.calls[0][0];
      expect(call.actorId).toBe('admin-1');
      expect(call.actorEmail).toBe('admin@test.com');
      expect(call.actorRoleId).toBe('role-admin');
    });

    it('stores requestId, ipAddress, userAgent when provided', async () => {
      await service.log({
        action: AUDIT_ACTIONS.USERS_CREATE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: 'user-1',
        actor: { id: 'admin-1' },
        request: {
          requestId: 'req-123',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
      });

      const call = repository.create.mock.calls[0][0];
      expect(call.requestId).toBe('req-123');
      expect(call.ipAddress).toBe('192.168.1.1');
      expect(call.userAgent).toBe('Mozilla/5.0');
    });

    it('defaults status to SUCCESS when not provided', async () => {
      await service.log({
        action: AUDIT_ACTIONS.USERS_CREATE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: 'user-1',
        actor: { id: 'admin-1' },
      });

      const call = repository.create.mock.calls[0][0];
      expect(call.status).toBe('SUCCESS');
    });

    it('uses provided status when given', async () => {
      await service.log({
        action: AUDIT_ACTIONS.USERS_CREATE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: 'user-1',
        status: 'FAILURE',
        actor: { id: 'admin-1' },
      });

      const call = repository.create.mock.calls[0][0];
      expect(call.status).toBe('FAILURE');
    });

    it('sanitizes sensitive values in before snapshot', async () => {
      await service.log({
        action: AUDIT_ACTIONS.USERS_UPDATE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: 'user-1',
        actor: { id: 'admin-1' },
        before: {
          id: 'user-1',
          passwordHash: 'old_hash',
        },
      });

      const call = repository.create.mock.calls[0][0];
      const before = call.before as Record<string, unknown>;
      expect(before['passwordHash']).toBe('<redacted>');
    });

    it('sanitizes sensitive values in after snapshot', async () => {
      await service.log({
        action: AUDIT_ACTIONS.USERS_CREATE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: 'user-1',
        actor: { id: 'admin-1' },
        after: {
          id: 'user-1',
          email: 'new@test.com',
          password: 'SuperSecret123',
        },
      });

      const call = repository.create.mock.calls[0][0];
      const after = call.after as Record<string, unknown>;
      expect(after['email']).toBe('new@test.com');
      expect(after['password']).toBe('<redacted>');
    });

    it('sanitizes nested sensitive values in metadata', async () => {
      await service.log({
        action: AUDIT_ACTIONS.USERS_UPDATE_ROLE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: 'user-1',
        actor: { id: 'admin-1' },
        metadata: {
          change: 'role',
          tokenHash: 'abc123',
          nested: { otp: '123456' },
        },
      });

      const call = repository.create.mock.calls[0][0];
      const metadata = call.metadata as Record<string, unknown>;
      expect(metadata['change']).toBe('role');
      expect(metadata['tokenHash']).toBe('<redacted>');
      const nested = metadata['nested'] as Record<string, unknown>;
      expect(nested['otp']).toBe('<redacted>');
    });

    it('does not throw when repository.create throws', async () => {
      repository.create.mockRejectedValueOnce(new Error('DB connection failed'));

      // Should NOT throw — error is caught internally
      await expect(
        service.log({
          action: AUDIT_ACTIONS.USERS_CREATE,
          resourceType: AUDIT_RESOURCE_TYPES.USER,
          resourceId: 'user-1',
        }),
      ).resolves.not.toThrow();
    });

    it('calls repository.create only once even on error', async () => {
      repository.create.mockRejectedValueOnce(new Error('DB error'));

      await service.log({
        action: AUDIT_ACTIONS.USERS_CREATE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: 'user-1',
      });

      expect(repository.create).toHaveBeenCalledTimes(1);
    });

    it('does not mutate original before object', async () => {
      const original = { password: 'secret123', name: 'John' };
      const originalCopy = { ...original };

      await service.log({
        action: AUDIT_ACTIONS.USERS_UPDATE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: 'user-1',
        actor: { id: 'admin-1' },
        before: original,
      });

      expect(original).toEqual(originalCopy);
    });

    it('does not mutate original after object', async () => {
      const original = { password: 'secret456', email: 'a@test.com' };
      const originalCopy = { ...original };

      await service.log({
        action: AUDIT_ACTIONS.USERS_CREATE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: 'user-1',
        actor: { id: 'admin-1' },
        after: original,
      });

      expect(original).toEqual(originalCopy);
    });

    it('passes resourceType and resourceId to repository', async () => {
      await service.log({
        action: AUDIT_ACTIONS.USERS_UPDATE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: 'user-abc',
        actor: { id: 'admin-1' },
      });

      const call = repository.create.mock.calls[0][0];
      expect(call.resourceType).toBe('User');
      expect(call.resourceId).toBe('user-abc');
    });
  });
});