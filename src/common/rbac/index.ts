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

export type { SystemPermissionKey } from './system-permissions';

export type { PermissionMode, RequiredPermissionsMetadata, AuthenticatedRouteMetadata } from './rbac.types';

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

// RBAC Constants
export {
  IS_PUBLIC_KEY,
  IS_AUTHENTICATED_KEY,
  REQUIRED_PERMISSIONS_KEY,
  PERMISSION_MODE_KEY,
} from './rbac.constants';

// Decorators
export { Public } from './decorators/public.decorator';
export { Authenticated } from './decorators/authenticated.decorator';
export { Permissions, AnyPermissions } from './decorators/permissions.decorator';

// Guards
export { PermissionsGuard } from './guards/permissions.guard';

// Services
export { EffectivePermissionsService } from './services/effective-permissions.service';