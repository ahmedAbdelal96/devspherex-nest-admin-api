import { SetMetadata } from '@nestjs/common';
import { REQUIRED_PERMISSIONS_KEY, PERMISSION_MODE_KEY } from '../rbac.constants';
import { PermissionMode } from '../rbac.types';
import type { SystemPermissionKey } from '../system-permissions';
import { assertValidSystemPermissionKey } from '../system-permissions';

/**
 * Requires all listed permissions (AND logic).
 * Sets both REQUIRED_PERMISSIONS_KEY and PERMISSION_MODE_KEY = 'all'.
 *
 * Usage:
 * @Permissions(SYSTEM_PERMISSION_KEYS.USERS.READ)
 * @Permissions(SYSTEM_PERMISSION_KEYS.USERS.CREATE, SYSTEM_PERMISSION_KEYS.USERS.UPDATE)
 */
export const Permissions = (...permissions: SystemPermissionKey[]): MethodDecorator & ClassDecorator => {
  for (const perm of permissions) {
    assertValidSystemPermissionKey(perm);
  }
  return (
    target: object,
    key?: string | symbol,
    descriptor?: TypedPropertyDescriptor<unknown>,
  ) => {
    if (key !== undefined && descriptor !== undefined) {
      // Method or property decorator
      (SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions) as MethodDecorator)(target, key, descriptor);
      (SetMetadata(PERMISSION_MODE_KEY, 'all' as PermissionMode) as MethodDecorator)(target, key, descriptor);
    } else {
      // Class decorator
      (SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions) as ClassDecorator)(target as Function);
      (SetMetadata(PERMISSION_MODE_KEY, 'all' as PermissionMode) as ClassDecorator)(target as Function);
    }
  };
};

/**
 * Requires at least one of the listed permissions (OR logic).
 * Sets both REQUIRED_PERMISSIONS_KEY and PERMISSION_MODE_KEY = 'any'.
 *
 * Usage:
 * @AnyPermissions(SYSTEM_PERMISSION_KEYS.USERS.READ, SYSTEM_PERMISSION_KEYS.USERS.UPDATE)
 */
export const AnyPermissions = (...permissions: SystemPermissionKey[]): MethodDecorator & ClassDecorator => {
  for (const perm of permissions) {
    assertValidSystemPermissionKey(perm);
  }
  return (
    target: object,
    key?: string | symbol,
    descriptor?: TypedPropertyDescriptor<unknown>,
  ) => {
    if (key !== undefined && descriptor !== undefined) {
      // Method or property decorator
      (SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions) as MethodDecorator)(target, key, descriptor);
      (SetMetadata(PERMISSION_MODE_KEY, 'any' as PermissionMode) as MethodDecorator)(target, key, descriptor);
    } else {
      // Class decorator
      (SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions) as ClassDecorator)(target as Function);
      (SetMetadata(PERMISSION_MODE_KEY, 'any' as PermissionMode) as ClassDecorator)(target as Function);
    }
  };
};