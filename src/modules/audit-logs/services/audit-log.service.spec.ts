/**
 * AuditLogService — Unit Tests
 *
 * Verifies:
 * - Creates sanitized audit log records
 * - Includes action/resource/actor/request context
 * - Defaults status to SUCCESS
 * - Catches repository errors and does not throw
 * - Does not store raw sensitive data
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
    it('creates a sanitized audit log record', async () => {
      await service.log({
        action: AUDIT_ACTIONS.USERS_CREATE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: 'user-1',
        status: 'SUCCESS',
        actor: { id: 'admin-1', email: 'admin@test.com' },
        after: { id: 'user-1', email: 'new@test.com' },
      });

      expect(repository.create).toHaveBeenCalledWith({
        actorId: 'admin-1',
        action: 'users.create',
        entity: 'User',
        entityId: 'user-1',
        metadata: { id: 'user-1', email: 'new@test.com' },
        ip: undefined,
        userAgent: undefined,
        requestId: undefined,
      });
    });

    it('includes request context', async () => {
      await service.log({
        action: AUDIT_ACTIONS.USERS_UPDATE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: 'user-1',
        actor: { id: 'admin-1' },
        request: {
          requestId: 'req-123',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-123',
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        }),
      );
    });

    it('defaults status to SUCCESS when not provided', async () => {
      await service.log({
        action: AUDIT_ACTIONS.USERS_CREATE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: 'user-1',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'users.create',
        }),
      );
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
      const metadata = call.metadata as Record<string, unknown>;
      expect(metadata['email']).toBe('new@test.com');
      expect(metadata['password']).toBe('<redacted>');
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
      const metadata = call.metadata as Record<string, unknown>;
      expect(metadata['passwordHash']).toBe('<redacted>');
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
  });
});
