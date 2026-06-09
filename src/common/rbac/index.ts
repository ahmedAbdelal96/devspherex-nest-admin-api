/**
 * RBAC Module - Public API
 *
 * This is the public interface for the RBAC permission system.
 * Import from here for controllers, guards, decorators, seed scripts, and tests.
 *
 * Usage:
 * import { SYSTEM_PERMISSION_KEYS, getSystemPermissionByKey } from '@common/rbac';
 * import { SYSTEM_PERMISSIONS } from '@common/rbac/system-permissions';
 */

// Types
export type {
  PermissionAction,
  PermissionResource,
  PermissionGroupName,
  SystemPermissionDefinition,
  SystemPermissionGroup,
  SystemPermissionKey,
  SystemPermissionKeyRecord,
  ValidatedPermission,
  SystemPermissionsValidationResult,
} from './permission.types';

// System Permissions (source of truth)
export {
  SYSTEM_PERMISSION_GROUPS,
  SYSTEM_PERMISSIONS,
  SYSTEM_PERMISSION_KEYS,
  SYSTEM_PERMISSION_KEY_SET,
  getSystemPermissionByKey,
  getPermissionsByGroup,
  assertValidSystemPermissionKey,
  validateSystemPermissions,
} from './system-permissions';

// Utility functions
export {
  flattenPermissionGroups,
  createPermissionKeySet,
  findDuplicatePermissionKeys,
  findInvalidPermissionDefinitions,
  groupPermissionsByGroup,
  isValidPermissionKey,
  getUniqueResources,
  getUniqueActions,
  filterByResource,
  filterByAction,
  searchPermissions,
} from './permission.utils';