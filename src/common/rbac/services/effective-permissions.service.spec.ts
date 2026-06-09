/**
 * EffectivePermissionsService — Unit Tests
 *
 * Tests permission computation with mocked Prisma.
 * No real database required.
 */

import { EffectivePermissionsService } from './effective-permissions.service';
import { SYSTEM_PERMISSION_KEYS } from '../system-permissions';
import { createMockPrismaService } from '../../../test-utils/mocks';

function buildService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = createMockPrismaService();
  Object.assign(prisma, prismaOverrides);
  return new EffectivePermissionsService(prisma as never);
}

describe('EffectivePermissionsService', () => {
  describe('getEffectivePermissionSet', () => {
    it('returns empty set for non-existent user', async () => {
      const prisma = createMockPrismaService();
      prisma.user.findUnique = jest.fn().mockResolvedValue(null);
      const svc = buildService(prisma);
      const result = await svc.getEffectivePermissionSet('nonexistent-user');
      expect(result.size).toBe(0);
    });

    it('returns empty set for inactive user', async () => {
      const prisma = createMockPrismaService();
      prisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        status: 'DISABLED',
        role: null,
        permissionOverrides: [],
      });
      const svc = buildService(prisma);
      const result = await svc.getEffectivePermissionSet('user-1');
      expect(result.size).toBe(0);
    });

    it('includes role permissions for active user', async () => {
      const prisma = createMockPrismaService();
      prisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        status: 'ACTIVE',
        role: {
          status: 'ACTIVE',
          deletedAt: null,
          permissions: [
            { permission: { key: SYSTEM_PERMISSION_KEYS.USERS.READ } },
            { permission: { key: SYSTEM_PERMISSION_KEYS.USERS.UPDATE } },
          ],
        },
        permissionOverrides: [],
      });
      const svc = buildService(prisma);
      const result = await svc.getEffectivePermissionSet('user-1');
      expect(result.has(SYSTEM_PERMISSION_KEYS.USERS.READ)).toBe(true);
      expect(result.has(SYSTEM_PERMISSION_KEYS.USERS.UPDATE)).toBe(true);
    });

    it('ignores disabled role', async () => {
      const prisma = createMockPrismaService();
      prisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        status: 'ACTIVE',
        role: {
          status: 'DISABLED',
          deletedAt: null,
          permissions: [{ permission: { key: SYSTEM_PERMISSION_KEYS.USERS.READ } }],
        },
        permissionOverrides: [],
      });
      const svc = buildService(prisma);
      const result = await svc.getEffectivePermissionSet('user-1');
      expect(result.size).toBe(0);
    });

    it('ignores soft-deleted role', async () => {
      const prisma = createMockPrismaService();
      prisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        status: 'ACTIVE',
        role: {
          status: 'ACTIVE',
          deletedAt: new Date(), // soft-deleted
          permissions: [{ permission: { key: SYSTEM_PERMISSION_KEYS.USERS.READ } }],
        },
        permissionOverrides: [],
      });
      const svc = buildService(prisma);
      const result = await svc.getEffectivePermissionSet('user-1');
      expect(result.size).toBe(0);
    });

    it('ALLOW override adds permission', async () => {
      const prisma = createMockPrismaService();
      prisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        status: 'ACTIVE',
        role: {
          status: 'ACTIVE',
          deletedAt: null,
          permissions: [{ permission: { key: SYSTEM_PERMISSION_KEYS.USERS.READ } }],
        },
        permissionOverrides: [
          { permission: { key: SYSTEM_PERMISSION_KEYS.USERS.DELETE }, effect: 'ALLOW' },
        ],
      });
      const svc = buildService(prisma);
      const result = await svc.getEffectivePermissionSet('user-1');
      expect(result.has(SYSTEM_PERMISSION_KEYS.USERS.DELETE)).toBe(true);
    });

    it('DENY override removes permission', async () => {
      const prisma = createMockPrismaService();
      prisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        status: 'ACTIVE',
        role: {
          status: 'ACTIVE',
          deletedAt: null,
          permissions: [{ permission: { key: SYSTEM_PERMISSION_KEYS.USERS.READ } }],
        },
        permissionOverrides: [
          { permission: { key: SYSTEM_PERMISSION_KEYS.USERS.READ }, effect: 'DENY' },
        ],
      });
      const svc = buildService(prisma);
      const result = await svc.getEffectivePermissionSet('user-1');
      expect(result.has(SYSTEM_PERMISSION_KEYS.USERS.READ)).toBe(false);
    });

    it('DENY wins over ALLOW when same key is in both', async () => {
      const prisma = createMockPrismaService();
      prisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        status: 'ACTIVE',
        role: {
          status: 'ACTIVE',
          deletedAt: null,
          permissions: [{ permission: { key: SYSTEM_PERMISSION_KEYS.USERS.READ } }],
        },
        permissionOverrides: [
          { permission: { key: SYSTEM_PERMISSION_KEYS.USERS.READ }, effect: 'ALLOW' },
          { permission: { key: SYSTEM_PERMISSION_KEYS.USERS.READ }, effect: 'DENY' },
        ],
      });
      const svc = buildService(prisma);
      const result = await svc.getEffectivePermissionSet('user-1');
      expect(result.has(SYSTEM_PERMISSION_KEYS.USERS.READ)).toBe(false);
    });

    it('ignores unknown permission keys from DB', async () => {
      const prisma = createMockPrismaService();
      prisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        status: 'ACTIVE',
        role: {
          status: 'ACTIVE',
          deletedAt: null,
          permissions: [
            { permission: { key: SYSTEM_PERMISSION_KEYS.USERS.READ } },
            { permission: { key: 'unknown.key' } },
          ],
        },
        permissionOverrides: [
          { permission: { key: 'stale.key' }, effect: 'ALLOW' },
        ],
      });
      const svc = buildService(prisma);
      const result = await svc.getEffectivePermissionSet('user-1');
      expect(result.has(SYSTEM_PERMISSION_KEYS.USERS.READ)).toBe(true);
      expect(result.has('unknown.key' as never)).toBe(false);
      expect(result.has('stale.key' as never)).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('returns true when user has all required permissions', async () => {
      const prisma = createMockPrismaService();
      prisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        status: 'ACTIVE',
        role: {
          status: 'ACTIVE',
          deletedAt: null,
          permissions: [{ permission: { key: SYSTEM_PERMISSION_KEYS.USERS.READ } }],
        },
        permissionOverrides: [],
      });
      const svc = buildService(prisma);
      const result = await svc.hasAllPermissions('user-1', [SYSTEM_PERMISSION_KEYS.USERS.READ]);
      expect(result).toBe(true);
    });

    it('returns false when user is missing a required permission', async () => {
      const prisma = createMockPrismaService();
      prisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        status: 'ACTIVE',
        role: {
          status: 'ACTIVE',
          deletedAt: null,
          permissions: [{ permission: { key: SYSTEM_PERMISSION_KEYS.USERS.READ } }],
        },
        permissionOverrides: [],
      });
      const svc = buildService(prisma);
      const result = await svc.hasAllPermissions('user-1', [SYSTEM_PERMISSION_KEYS.USERS.DELETE]);
      expect(result).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('returns true when user has at least one', async () => {
      const prisma = createMockPrismaService();
      prisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        status: 'ACTIVE',
        role: {
          status: 'ACTIVE',
          deletedAt: null,
          permissions: [{ permission: { key: SYSTEM_PERMISSION_KEYS.USERS.READ } }],
        },
        permissionOverrides: [],
      });
      const svc = buildService(prisma);
      const result = await svc.hasAnyPermission('user-1', [SYSTEM_PERMISSION_KEYS.USERS.DELETE, SYSTEM_PERMISSION_KEYS.USERS.READ]);
      expect(result).toBe(true);
    });

    it('returns false when user has none', async () => {
      const prisma = createMockPrismaService();
      prisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        status: 'ACTIVE',
        role: {
          status: 'ACTIVE',
          deletedAt: null,
          permissions: [{ permission: { key: SYSTEM_PERMISSION_KEYS.USERS.READ } }],
        },
        permissionOverrides: [],
      });
      const svc = buildService(prisma);
      const result = await svc.hasAnyPermission('user-1', [SYSTEM_PERMISSION_KEYS.USERS.DELETE, SYSTEM_PERMISSION_KEYS.USERS.UPDATE]);
      expect(result).toBe(false);
    });
  });
});
