import { applyDecorators, SetMetadata } from '@nestjs/common';
import { REQUIRED_PERMISSIONS_KEY, PERMISSION_MODE_KEY } from '../rbac.constants';
import { PermissionMode } from '../rbac.types';
import type { SystemPermissionKey } from '../system-permissions';
import { assertValidSystemPermissionKey } from '../system-permissions';

/**
 * Requires ALL listed permissions (AND logic).
 * Sets both REQUIRED_PERMISSIONS_KEY and PERMISSION_MODE_KEY = 'all'.
 *
 * Usage:
 * @Permissions(SYSTEM_PERMISSION_KEYS.USERS.READ)
 * @Permissions(SYSTEM_PERMISSION_KEYS.USERS.CREATE, SYSTEM_PERMISSION_KEYS.USERS.UPDATE)
 *
 * All keys are validated at decoration time against SYSTEM_PERMISSION_KEY_SET.
 * An unknown key throws Error('Invalid permission key: "<key>"') immediately,
 * preventing typos from silently creating security holes.
 */
export const Permissions = (
  ...permissions: SystemPermissionKey[]
): MethodDecorator & ClassDecorator => {
  for (const permission of permissions) {
    assertValidSystemPermissionKey(permission);
  }

  return applyDecorators(
    SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions),
    SetMetadata(PERMISSION_MODE_KEY, 'all' as PermissionMode),
  );
};

/**
 * Requires AT LEAST ONE of the listed permissions (OR logic).
 * Sets both REQUIRED_PERMISSIONS_KEY and PERMISSION_MODE_KEY = 'any'.
 *
 * Usage:
 * @AnyPermissions(SYSTEM_PERMISSION_KEYS.USERS.READ, SYSTEM_PERMISSION_KEYS.USERS.UPDATE)
 */
export const AnyPermissions = (
  ...permissions: SystemPermissionKey[]
): MethodDecorator & ClassDecorator => {
  for (const permission of permissions) {
    assertValidSystemPermissionKey(permission);
  }

  return applyDecorators(
    SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions),
    SetMetadata(PERMISSION_MODE_KEY, 'any' as PermissionMode),
  );
};
