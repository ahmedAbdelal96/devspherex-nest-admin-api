/**
 * System Permissions - Central Source of Truth
 *
 * This file is the ONLY source of truth for all system permissions.
 * All controllers, guards, decorators, seed scripts, and tests must import
 * permission keys from here.
 *
 * PERMISSION NAMING RULES:
 * - Keys use dot notation: resource.action
 * - All lowercase
 * - Resource is singular: users, roles, permissions
 * - Actions follow consistent patterns: read, create, update, delete
 * - Compound actions use dot: permissions.update, status.update
 *
 * HOW TO USE:
 * import { SYSTEM_PERMISSION_KEYS, getSystemPermissionByKey } from './index';
 * import { SYSTEM_PERMISSIONS } from './system-permissions';
 *
 * // In decorators/guards:
 * @Permissions(SYSTEM_PERMISSION_KEYS.USERS.READ)
 *
 * // In seed scripts:
 * const permissionsToSeed = SYSTEM_PERMISSIONS;
 *
 * IMPORTANT:
 * - Do NOT hardcode permission strings like 'users.read' in other files
 * - Do NOT create permissions outside this file
 * - Do NOT import Prisma in this file
 */

import type {
  SystemPermissionDefinition,
  SystemPermissionGroup,
  SystemPermissionKey,
  SystemPermissionsValidationResult,
} from './permission.types';

// ============================================
// PERMISSION GROUPS
// ============================================

/**
 * Auth / Account Permissions
 */
const AUTH_PERMISSIONS: SystemPermissionDefinition[] = [
  {
    key: 'auth.me.read',
    resource: 'auth',
    action: 'read',
    label: 'View own account',
    description: 'Allows viewing the current user profile and account details',
    group: 'Auth',
    isSystem: true,
  },
  {
    key: 'auth.password.change',
    resource: 'auth',
    action: 'password.change',
    label: 'Change password',
    description: 'Allows changing the current user password',
    group: 'Auth',
    isSystem: true,
  },
];

/**
 * Users Management Permissions
 */
const USERS_PERMISSIONS: SystemPermissionDefinition[] = [
  {
    key: 'users.read',
    resource: 'users',
    action: 'read',
    label: 'View users',
    description: 'Allows listing and viewing user accounts',
    group: 'Users',
    isSystem: true,
  },
  {
    key: 'users.create',
    resource: 'users',
    action: 'create',
    label: 'Create users',
    description: 'Allows creating new user accounts',
    group: 'Users',
    isSystem: true,
  },
  {
    key: 'users.update',
    resource: 'users',
    action: 'update',
    label: 'Update users',
    description: 'Allows updating user account details',
    group: 'Users',
    isSystem: true,
  },
  {
    key: 'users.delete',
    resource: 'users',
    action: 'delete',
    label: 'Delete users',
    description: 'Allows deleting user accounts',
    group: 'Users',
    isSystem: true,
  },
  {
    key: 'users.status.update',
    resource: 'users',
    action: 'status.update',
    label: 'Update user status',
    description: 'Allows enabling or disabling user accounts',
    group: 'Users',
    isSystem: true,
  },
  {
    key: 'users.role.update',
    resource: 'users',
    action: 'role.update',
    label: 'Update user role',
    description: 'Allows assigning or changing user roles',
    group: 'Users',
    isSystem: true,
  },
  {
    key: 'users.permissions.read',
    resource: 'users',
    action: 'permissions.read',
    label: 'View user permissions',
    description: 'Allows viewing effective permissions for a user',
    group: 'Users',
    isSystem: true,
  },
  {
    key: 'users.permissions.override',
    resource: 'users',
    action: 'permissions.override',
    label: 'Override user permissions',
    description: 'Allows adding direct permission overrides (allow/deny) for a user',
    group: 'Users',
    isSystem: true,
  },
];

/**
 * Roles Management Permissions
 */
const ROLES_PERMISSIONS: SystemPermissionDefinition[] = [
  {
    key: 'roles.read',
    resource: 'roles',
    action: 'read',
    label: 'View roles',
    description: 'Allows listing and viewing roles',
    group: 'Roles',
    isSystem: true,
  },
  {
    key: 'roles.create',
    resource: 'roles',
    action: 'create',
    label: 'Create roles',
    description: 'Allows creating new roles',
    group: 'Roles',
    isSystem: true,
  },
  {
    key: 'roles.update',
    resource: 'roles',
    action: 'update',
    label: 'Update roles',
    description: 'Allows updating role details',
    group: 'Roles',
    isSystem: true,
  },
  {
    key: 'roles.delete',
    resource: 'roles',
    action: 'delete',
    label: 'Delete roles',
    description: 'Allows deleting roles',
    group: 'Roles',
    isSystem: true,
  },
  {
    key: 'roles.permissions.update',
    resource: 'roles',
    action: 'permissions.update',
    label: 'Update role permissions',
    description: 'Allows assigning permissions to roles',
    group: 'Roles',
    isSystem: true,
  },
  {
    key: 'roles.duplicate',
    resource: 'roles',
    action: 'duplicate',
    label: 'Duplicate roles',
    description: 'Allows duplicating existing roles with their permissions',
    group: 'Roles',
    isSystem: true,
  },
];

/**
 * Permissions Management Permissions
 */
const PERMISSIONS_PERMISSIONS: SystemPermissionDefinition[] = [
  {
    key: 'permissions.read',
    resource: 'permissions',
    action: 'read',
    label: 'View permissions',
    description: 'Allows listing and viewing all available permissions',
    group: 'Permissions',
    isSystem: true,
  },
  {
    key: 'permissions.grouped.read',
    resource: 'permissions',
    action: 'grouped.read',
    label: 'View grouped permissions',
    description: 'Allows viewing permissions organized by group',
    group: 'Permissions',
    isSystem: true,
  },
];

/**
 * Audit Logs Permissions
 */
const AUDIT_LOGS_PERMISSIONS: SystemPermissionDefinition[] = [
  {
    key: 'auditLogs.read',
    resource: 'auditLogs',
    action: 'read',
    label: 'View audit logs',
    description: 'Allows viewing system audit logs',
    group: 'Audit Logs',
    isSystem: true,
  },
  {
    key: 'auditLogs.create',
    resource: 'auditLogs',
    action: 'create',
    label: 'Create audit log entries',
    description: 'Allows creating audit log entries (used by system, not typically assigned)',
    group: 'Audit Logs',
    isSystem: true,
  },
];

/**
 * API Request Logs Permissions
 */
const API_REQUEST_LOGS_PERMISSIONS: SystemPermissionDefinition[] = [
  {
    key: 'apiRequestLogs.read',
    resource: 'apiRequestLogs',
    action: 'read',
    label: 'View API request logs',
    description: 'Allows viewing API request/response logs',
    group: 'API Request Logs',
    isSystem: true,
  },
];

/**
 * System / Settings Permissions
 */
const SYSTEM_SETTINGS_PERMISSIONS: SystemPermissionDefinition[] = [
  {
    key: 'system.health.read',
    resource: 'system',
    action: 'health.read',
    label: 'View system health',
    description: 'Allows viewing system health status',
    group: 'System',
    isSystem: true,
  },
  {
    key: 'settings.read',
    resource: 'settings',
    action: 'read',
    label: 'View settings',
    description: 'Allows viewing system settings',
    group: 'System',
    isSystem: true,
  },
  {
    key: 'settings.update',
    resource: 'settings',
    action: 'update',
    label: 'Update settings',
    description: 'Allows modifying system settings',
    group: 'System',
    isSystem: true,
  },
];

// ============================================
// PERMISSION GROUPS ARRAY
// ============================================

/**
 * All permission groups in display order
 */
export const SYSTEM_PERMISSION_GROUPS: SystemPermissionGroup[] = [
  { name: 'Auth', permissions: AUTH_PERMISSIONS },
  { name: 'Users', permissions: USERS_PERMISSIONS },
  { name: 'Roles', permissions: ROLES_PERMISSIONS },
  { name: 'Permissions', permissions: PERMISSIONS_PERMISSIONS },
  { name: 'Audit Logs', permissions: AUDIT_LOGS_PERMISSIONS },
  { name: 'API Request Logs', permissions: API_REQUEST_LOGS_PERMISSIONS },
  { name: 'System', permissions: SYSTEM_SETTINGS_PERMISSIONS },
];

// ============================================
// FLAT PERMISSION LISTS
// ============================================

/**
 * Flat list of all system permissions (derived from groups)
 */
export const SYSTEM_PERMISSIONS: SystemPermissionDefinition[] =
  SYSTEM_PERMISSION_GROUPS.flatMap((group) => group.permissions);

/**
 * Array of all permission keys
 */
export const SYSTEM_PERMISSION_KEYS: SystemPermissionKey[] =
  SYSTEM_PERMISSIONS.map((p) => p.key);

/**
 * Set of all permission keys for fast lookup
 */
export const SYSTEM_PERMISSION_KEY_SET: Set<SystemPermissionKey> =
  new Set(SYSTEM_PERMISSION_KEYS);

// ============================================
// LOOKUP FUNCTIONS
// ============================================

/**
 * Get a permission definition by its key
 * @param key - The permission key (e.g., "users.read")
 * @returns The permission definition or undefined if not found
 */
export function getSystemPermissionByKey(
  key: string,
): SystemPermissionDefinition | undefined {
  return SYSTEM_PERMISSIONS.find((p) => p.key === key);
}

/**
 * Get permissions by group name
 * @param groupName - The group name (e.g., "Users")
 * @returns Array of permissions in the group
 */
export function getPermissionsByGroup(
  groupName: string,
): SystemPermissionDefinition[] {
  const group = SYSTEM_PERMISSION_GROUPS.find(
    (g) => g.name === groupName,
  );
  return group?.permissions ?? [];
}

/**
 * Assert that a key is a valid system permission key
 * Throws an error if the key is not found
 * @param key - The permission key to validate
 */
export function assertValidSystemPermissionKey(key: string): void {
  if (!SYSTEM_PERMISSION_KEY_SET.has(key as SystemPermissionKey)) {
    throw new Error(`Invalid system permission key: "${key}". Valid keys are defined in SYSTEM_PERMISSION_KEYS.`);
  }
}

/**
 * Validate all system permissions
 * Checks for duplicates, missing fields, and structural issues
 * @returns Validation result
 */
export function validateSystemPermissions(): SystemPermissionsValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for duplicate keys
  const seenKeys = new Set<string>();
  for (const permission of SYSTEM_PERMISSIONS) {
    if (seenKeys.has(permission.key)) {
      errors.push(`Duplicate permission key found: "${permission.key}"`);
    }
    seenKeys.add(permission.key);
  }

  // Check that every permission has required fields
  for (const permission of SYSTEM_PERMISSIONS) {
    if (!permission.key) {
      errors.push('Permission missing required field: key');
    }
    if (!permission.resource) {
      errors.push(`Permission with key "${permission.key}" missing required field: resource`);
    }
    if (!permission.action) {
      errors.push(`Permission with key "${permission.key}" missing required field: action`);
    }
    if (!permission.label) {
      errors.push(`Permission with key "${permission.key}" missing required field: label`);
    }
    if (!permission.group) {
      errors.push(`Permission with key "${permission.key}" missing required field: group`);
    }
    if (permission.isSystem !== true) {
      errors.push(`Permission with key "${permission.key}" must have isSystem: true`);
    }
  }

  // Check key format (dot notation, lowercase)
  for (const permission of SYSTEM_PERMISSIONS) {
    if (!permission.key.includes('.')) {
      errors.push(`Permission key "${permission.key}" must use dot notation (resource.action)`);
    }
    if (permission.key !== permission.key.toLowerCase()) {
      errors.push(`Permission key "${permission.key}" must be lowercase`);
    }
    if (permission.key.startsWith('.') || permission.key.endsWith('.')) {
      errors.push(`Permission key "${permission.key}" must not start or end with a dot`);
    }
  }

  // Check key count matches
  if (SYSTEM_PERMISSION_KEYS.length !== SYSTEM_PERMISSIONS.length) {
    errors.push(
      `SYSTEM_PERMISSION_KEYS length (${SYSTEM_PERMISSION_KEYS.length}) ` +
      `does not match SYSTEM_PERMISSIONS length (${SYSTEM_PERMISSIONS.length})`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    totalCount: SYSTEM_PERMISSIONS.length,
  };
}

// ============================================
// TYPE EXPORTS FOR CONVENIENCE
// ============================================

export type { SystemPermissionDefinition, SystemPermissionGroup } from './permission.types';