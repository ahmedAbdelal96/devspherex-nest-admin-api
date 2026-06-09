/**
 * PermissionsGuard — Unit Tests
 *
 * Tests guard logic with mocked Reflector and EffectivePermissionsService.
 */

import { ForbiddenException } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';
import { EffectivePermissionsService } from '../services/effective-permissions.service';
import { IS_PUBLIC_KEY, IS_AUTHENTICATED_KEY, REQUIRED_PERMISSIONS_KEY, PERMISSION_MODE_KEY } from '../rbac.constants';
import { SYSTEM_PERMISSION_KEYS } from '../system-permissions';
import { createMockReflector, createMockExecutionContext } from '../../../test-utils/mocks';

describe('PermissionsGuard', () => {
  function buildGuard(
    reflectorOverrides: Record<string, unknown> = {},
    effectivePermissionsService: EffectivePermissionsService = null as never,
  ) {
    const reflector = createMockReflector(reflectorOverrides);
    return new PermissionsGuard(reflector, effectivePermissionsService);
  }

  describe('public route', () => {
    it('allows without user', async () => {
      const guard = buildGuard({ [IS_PUBLIC_KEY]: true });
      const context = createMockExecutionContext({});
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  describe('authenticated route', () => {
    it('allows when request.user exists', async () => {
      const guard = buildGuard(
        { [IS_AUTHENTICATED_KEY]: true, [REQUIRED_PERMISSIONS_KEY]: null },
        {} as unknown as EffectivePermissionsService,
      );
      const context = createMockExecutionContext({ user: { id: 'user-1' } });
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('denies when request.user is missing', async () => {
      const guard = buildGuard({ [IS_AUTHENTICATED_KEY]: true });
      const context = createMockExecutionContext({});
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('denies non-public route with no classification', async () => {
      const guard = buildGuard({ [IS_PUBLIC_KEY]: false, [IS_AUTHENTICATED_KEY]: false, [REQUIRED_PERMISSIONS_KEY]: null });
      const context = createMockExecutionContext({ user: { id: 'user-1' } });
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('permission checks — all mode', () => {
    it('allows when user has all required permissions', async () => {
      const effectivePermissionsService = {
        hasAllPermissions: jest.fn().mockResolvedValue(true),
      } as unknown as EffectivePermissionsService;
      const guard = buildGuard(
        {
          [IS_PUBLIC_KEY]: false,
          [REQUIRED_PERMISSIONS_KEY]: [SYSTEM_PERMISSION_KEYS.USERS.READ],
          [PERMISSION_MODE_KEY]: 'all',
        },
        effectivePermissionsService,
      );
      const context = createMockExecutionContext({ user: { id: 'user-1' } });
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(effectivePermissionsService.hasAllPermissions).toHaveBeenCalledWith(
        'user-1',
        [SYSTEM_PERMISSION_KEYS.USERS.READ],
      );
    });

    it('denies when user is missing a required permission', async () => {
      const effectivePermissionsService = {
        hasAllPermissions: jest.fn().mockResolvedValue(false),
      } as unknown as EffectivePermissionsService;
      const guard = buildGuard(
        {
          [IS_PUBLIC_KEY]: false,
          [REQUIRED_PERMISSIONS_KEY]: [SYSTEM_PERMISSION_KEYS.USERS.READ, SYSTEM_PERMISSION_KEYS.USERS.DELETE],
          [PERMISSION_MODE_KEY]: 'all',
        },
        effectivePermissionsService,
      );
      const context = createMockExecutionContext({ user: { id: 'user-1' } });
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('permission checks — any mode', () => {
    it('allows when user has at least one permission', async () => {
      const effectivePermissionsService = {
        hasAnyPermission: jest.fn().mockResolvedValue(true),
      } as unknown as EffectivePermissionsService;
      const guard = buildGuard(
        {
          [IS_PUBLIC_KEY]: false,
          [REQUIRED_PERMISSIONS_KEY]: [SYSTEM_PERMISSION_KEYS.USERS.READ, SYSTEM_PERMISSION_KEYS.USERS.DELETE],
          [PERMISSION_MODE_KEY]: 'any',
        },
        effectivePermissionsService,
      );
      const context = createMockExecutionContext({ user: { id: 'user-1' } });
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('denies when user has none of the any-permission list', async () => {
      const effectivePermissionsService = {
        hasAnyPermission: jest.fn().mockResolvedValue(false),
      } as unknown as EffectivePermissionsService;
      const guard = buildGuard(
        {
          [IS_PUBLIC_KEY]: false,
          [REQUIRED_PERMISSIONS_KEY]: [SYSTEM_PERMISSION_KEYS.USERS.READ, SYSTEM_PERMISSION_KEYS.USERS.DELETE],
          [PERMISSION_MODE_KEY]: 'any',
        },
        effectivePermissionsService,
      );
      const context = createMockExecutionContext({ user: { id: 'user-1' } });
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });
});
