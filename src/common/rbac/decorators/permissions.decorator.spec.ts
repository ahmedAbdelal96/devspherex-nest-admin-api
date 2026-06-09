/**
 * RBAC Decorators — Unit Tests
 *
 * Tests @Public(), @Authenticated(), @Permissions(), @AnyPermissions()
 * metadata wiring.
 */

import { SetMetadata } from '@nestjs/common';
import { Public } from '../decorators/public.decorator';
import { Authenticated } from '../decorators/authenticated.decorator';
import { Permissions, AnyPermissions } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY, IS_AUTHENTICATED_KEY, REQUIRED_PERMISSIONS_KEY, PERMISSION_MODE_KEY } from '../rbac.constants';
import { SYSTEM_PERMISSION_KEYS } from '../system-permissions';

jest.mock('@nestjs/common', () => ({
  ...jest.requireActual('@nestjs/common'),
  SetMetadata: jest.fn(),
}));

const mockSetMetadata = SetMetadata as jest.MockedFunction<typeof SetMetadata>;

describe('RBAC Decorators', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('@Public()', () => {
    it('calls SetMetadata with IS_PUBLIC_KEY and true', () => {
      Public();
      expect(mockSetMetadata).toHaveBeenCalledWith(IS_PUBLIC_KEY, true);
    });
  });

  describe('@Authenticated()', () => {
    it('calls SetMetadata with IS_AUTHENTICATED_KEY and true', () => {
      Authenticated();
      expect(mockSetMetadata).toHaveBeenCalledWith(IS_AUTHENTICATED_KEY, true);
    });
  });

  describe('@Permissions()', () => {
    it('validates and stores permission keys', () => {
      Permissions(SYSTEM_PERMISSION_KEYS.USERS.READ);
      expect(mockSetMetadata).toHaveBeenCalledWith(
        REQUIRED_PERMISSIONS_KEY,
        [SYSTEM_PERMISSION_KEYS.USERS.READ],
      );
      expect(mockSetMetadata).toHaveBeenCalledWith(PERMISSION_MODE_KEY, 'all');
    });

    it('stores multiple keys with all mode', () => {
      Permissions(SYSTEM_PERMISSION_KEYS.USERS.READ, SYSTEM_PERMISSION_KEYS.USERS.UPDATE);
      expect(mockSetMetadata).toHaveBeenCalledWith(
        REQUIRED_PERMISSIONS_KEY,
        [SYSTEM_PERMISSION_KEYS.USERS.READ, SYSTEM_PERMISSION_KEYS.USERS.UPDATE],
      );
      expect(mockSetMetadata).toHaveBeenCalledWith(PERMISSION_MODE_KEY, 'all');
    });

    it('throws on invalid permission key', () => {
      expect(() => (Permissions as Function)('invalid.key' as never)).toThrow('Invalid permission key');
    });
  });

  describe('@AnyPermissions()', () => {
    it('stores permission keys with any mode', () => {
      AnyPermissions(SYSTEM_PERMISSION_KEYS.USERS.READ, SYSTEM_PERMISSION_KEYS.USERS.DELETE);
      expect(mockSetMetadata).toHaveBeenCalledWith(
        REQUIRED_PERMISSIONS_KEY,
        [SYSTEM_PERMISSION_KEYS.USERS.READ, SYSTEM_PERMISSION_KEYS.USERS.DELETE],
      );
      expect(mockSetMetadata).toHaveBeenCalledWith(PERMISSION_MODE_KEY, 'any');
    });

    it('throws on invalid permission key', () => {
      expect(() => (AnyPermissions as Function)('invalid.key' as never)).toThrow('Invalid permission key');
    });
  });
});
