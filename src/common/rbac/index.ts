/**
 * RBAC Module - Public API
 *
 * Import from here for controllers, guards, decorators, seed scripts, and tests.
 *
 * Usage:
 * import { SYSTEM_PERMISSION_KEYS, SYSTEM_PERMISSION_KEY_LIST, getSystemPermissionByKey } from '@common/rbac';
 * import { SYSTEM_PERMISSIONS } from '@common/rbac/system-permissions';
 */

// Types
export type {
  PermissionAction,
  PermissionResource,
  PermissionGroupName,
  SystemPermissionDefinition,
  SystemPermissionGroup,
  ValidatedPermission,
  SystemPermissionsValidationResult,
} from './permission.types';

// Re-export the key type (derived from SYSTEM_PERMISSION_KEYS)
export type { SystemPermissionKey } from './system-permissions';

// System Permissions
export {
  SYSTEM_PERMISSION_KEYS,
  SYSTEM_PERMISSION_KEY_LIST,
  SYSTEM_PERMISSION_KEY_SET,
  SYSTEM_PERMISSION_GROUPS,
  SYSTEM_PERMISSIONS,
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