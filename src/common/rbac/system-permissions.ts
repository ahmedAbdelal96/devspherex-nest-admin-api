/**
 * System Permissions - Central Source of Truth
 *
 * Single source for all system permissions.
 * Import keys from SYSTEM_PERMISSION_KEYS, definitions from SYSTEM_PERMISSIONS.
 *
 * Naming: lowercase dot notation, kebab-case for multi-word resources
 * Example: users.read, audit-logs.read, api-request-logs.read
 */

import type {
  SystemPermissionDefinition,
  SystemPermissionGroup,
  SystemPermissionsValidationResult,
} from './permission.types';

// ============================================
// NAMESPACED PERMISSION KEYS
// ============================================

export const SYSTEM_PERMISSION_KEYS = {
  AUTH: {
    ME_READ: 'auth.me.read',
    PASSWORD_CHANGE: 'auth.password.change',
  },
  USERS: {
    READ: 'users.read',
    CREATE: 'users.create',
    UPDATE: 'users.update',
    DELETE: 'users.delete',
    STATUS_UPDATE: 'users.status.update',
    ROLE_UPDATE: 'users.role.update',
    PERMISSIONS_READ: 'users.permissions.read',
    PERMISSIONS_OVERRIDE: 'users.permissions.override',
  },
  ROLES: {
    READ: 'roles.read',
    CREATE: 'roles.create',
    UPDATE: 'roles.update',
    DELETE: 'roles.delete',
    PERMISSIONS_UPDATE: 'roles.permissions.update',
    DUPLICATE: 'roles.duplicate',
  },
  PERMISSIONS: {
    READ: 'permissions.read',
    GROUPED_READ: 'permissions.grouped.read',
  },
  AUDIT_LOGS: {
    READ: 'audit-logs.read',
    CREATE: 'audit-logs.create',
  },
  API_REQUEST_LOGS: {
    READ: 'api-request-logs.read',
  },
  SYSTEM: {
    HEALTH_READ: 'system.health.read',
  },
  SETTINGS: {
    READ: 'settings.read',
    UPDATE: 'settings.update',
  },
} as const;

// ============================================
// HELPER: Deep value of object
// ============================================

type ValueOf<T> = T[keyof T];
type DeepValueOf<T> = T extends object ? DeepValueOf<ValueOf<T>> : T;

export type SystemPermissionKey = DeepValueOf<typeof SYSTEM_PERMISSION_KEYS>;

// ============================================
// PERMISSION GROUPS (definitions)
// ============================================

const AUTH_PERMISSIONS: SystemPermissionDefinition[] = [
  {
    key: SYSTEM_PERMISSION_KEYS.AUTH.ME_READ,
    resource: 'auth',
    action: 'read',
    label: 'View own account',
    description: 'Allows viewing the current user profile',
    group: 'Auth',
    isSystem: true,
  },
  {
    key: SYSTEM_PERMISSION_KEYS.AUTH.PASSWORD_CHANGE,
    resource: 'auth',
    action: 'password.change',
    label: 'Change password',
    description: 'Allows changing the current user password',
    group: 'Auth',
    isSystem: true,
  },
];

const USERS_PERMISSIONS: SystemPermissionDefinition[] = [
  { key: SYSTEM_PERMISSION_KEYS.USERS.READ, resource: 'users', action: 'read', label: 'View users', group: 'Users', isSystem: true },
  { key: SYSTEM_PERMISSION_KEYS.USERS.CREATE, resource: 'users', action: 'create', label: 'Create users', group: 'Users', isSystem: true },
  { key: SYSTEM_PERMISSION_KEYS.USERS.UPDATE, resource: 'users', action: 'update', label: 'Update users', group: 'Users', isSystem: true },
  { key: SYSTEM_PERMISSION_KEYS.USERS.DELETE, resource: 'users', action: 'delete', label: 'Delete users', group: 'Users', isSystem: true },
  { key: SYSTEM_PERMISSION_KEYS.USERS.STATUS_UPDATE, resource: 'users', action: 'status.update', label: 'Update user status', group: 'Users', isSystem: true },
  { key: SYSTEM_PERMISSION_KEYS.USERS.ROLE_UPDATE, resource: 'users', action: 'role.update', label: 'Update user role', group: 'Users', isSystem: true },
  { key: SYSTEM_PERMISSION_KEYS.USERS.PERMISSIONS_READ, resource: 'users', action: 'permissions.read', label: 'View user permissions', group: 'Users', isSystem: true },
  { key: SYSTEM_PERMISSION_KEYS.USERS.PERMISSIONS_OVERRIDE, resource: 'users', action: 'permissions.override', label: 'Override user permissions', group: 'Users', isSystem: true },
];

const ROLES_PERMISSIONS: SystemPermissionDefinition[] = [
  { key: SYSTEM_PERMISSION_KEYS.ROLES.READ, resource: 'roles', action: 'read', label: 'View roles', group: 'Roles', isSystem: true },
  { key: SYSTEM_PERMISSION_KEYS.ROLES.CREATE, resource: 'roles', action: 'create', label: 'Create roles', group: 'Roles', isSystem: true },
  { key: SYSTEM_PERMISSION_KEYS.ROLES.UPDATE, resource: 'roles', action: 'update', label: 'Update roles', group: 'Roles', isSystem: true },
  { key: SYSTEM_PERMISSION_KEYS.ROLES.DELETE, resource: 'roles', action: 'delete', label: 'Delete roles', group: 'Roles', isSystem: true },
  { key: SYSTEM_PERMISSION_KEYS.ROLES.PERMISSIONS_UPDATE, resource: 'roles', action: 'permissions.update', label: 'Update role permissions', group: 'Roles', isSystem: true },
  { key: SYSTEM_PERMISSION_KEYS.ROLES.DUPLICATE, resource: 'roles', action: 'duplicate', label: 'Duplicate roles', group: 'Roles', isSystem: true },
];

const PERMISSIONS_PERMISSIONS: SystemPermissionDefinition[] = [
  { key: SYSTEM_PERMISSION_KEYS.PERMISSIONS.READ, resource: 'permissions', action: 'read', label: 'View permissions', group: 'Permissions', isSystem: true },
  { key: SYSTEM_PERMISSION_KEYS.PERMISSIONS.GROUPED_READ, resource: 'permissions', action: 'grouped.read', label: 'View grouped permissions', group: 'Permissions', isSystem: true },
];

const AUDIT_LOGS_PERMISSIONS: SystemPermissionDefinition[] = [
  { key: SYSTEM_PERMISSION_KEYS.AUDIT_LOGS.READ, resource: 'audit-logs', action: 'read', label: 'View audit logs', group: 'Audit Logs', isSystem: true },
  { key: SYSTEM_PERMISSION_KEYS.AUDIT_LOGS.CREATE, resource: 'audit-logs', action: 'create', label: 'Create audit log entries', group: 'Audit Logs', isSystem: true },
];

const API_REQUEST_LOGS_PERMISSIONS: SystemPermissionDefinition[] = [
  { key: SYSTEM_PERMISSION_KEYS.API_REQUEST_LOGS.READ, resource: 'api-request-logs', action: 'read', label: 'View API request logs', group: 'API Request Logs', isSystem: true },
];

const SYSTEM_SETTINGS_PERMISSIONS: SystemPermissionDefinition[] = [
  { key: SYSTEM_PERMISSION_KEYS.SYSTEM.HEALTH_READ, resource: 'system', action: 'health.read', label: 'View system health', group: 'System', isSystem: true },
  { key: SYSTEM_PERMISSION_KEYS.SETTINGS.READ, resource: 'settings', action: 'read', label: 'View settings', group: 'System', isSystem: true },
  { key: SYSTEM_PERMISSION_KEYS.SETTINGS.UPDATE, resource: 'settings', action: 'update', label: 'Update settings', group: 'System', isSystem: true },
];

// ============================================
// PERMISSION GROUPS ARRAY
// ============================================

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
// FLAT LISTS (derived)
// ============================================

export const SYSTEM_PERMISSIONS: SystemPermissionDefinition[] =
  SYSTEM_PERMISSION_GROUPS.flatMap((g) => g.permissions);

export const SYSTEM_PERMISSION_KEY_LIST: SystemPermissionKey[] =
  SYSTEM_PERMISSIONS.map((p) => p.key as SystemPermissionKey);

export const SYSTEM_PERMISSION_KEY_SET: Set<SystemPermissionKey> =
  new Set(SYSTEM_PERMISSION_KEY_LIST);

// ============================================
// LOOKUP FUNCTIONS
// ============================================

export function getSystemPermissionByKey(key: string): SystemPermissionDefinition | undefined {
  return SYSTEM_PERMISSIONS.find((p) => p.key === key);
}

export function getPermissionsByGroup(groupName: string): SystemPermissionDefinition[] {
  return SYSTEM_PERMISSION_GROUPS.find((g) => g.name === groupName)?.permissions ?? [];
}

export function assertValidSystemPermissionKey(key: string): void {
  if (!SYSTEM_PERMISSION_KEY_SET.has(key as SystemPermissionKey)) {
    throw new Error(`Invalid permission key: "${key}"`);
  }
}

// ============================================
// VALIDATION
// ============================================

export function validateSystemPermissions(): SystemPermissionsValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check duplicate keys in SYSTEM_PERMISSIONS
  const seenKeys = new Set<string>();
  for (const p of SYSTEM_PERMISSIONS) {
    if (seenKeys.has(p.key)) errors.push(`Duplicate key: "${p.key}"`);
    seenKeys.add(p.key);
  }

  // Check all keys in definitions exist in KEY_LIST
  for (const p of SYSTEM_PERMISSIONS) {
    if (!SYSTEM_PERMISSION_KEY_LIST.includes(p.key as SystemPermissionKey)) {
      errors.push(`Definition key "${p.key}" not in KEY_LIST`);
    }
  }

  // Check all keys in KEY_LIST exist in definitions
  for (const key of SYSTEM_PERMISSION_KEY_LIST) {
    if (!SYSTEM_PERMISSIONS.find((p) => p.key === key)) {
      errors.push(`KEY_LIST key "${key}" not in definitions`);
    }
  }

  // Check SET size matches LIST length
  if (SYSTEM_PERMISSION_KEY_SET.size !== SYSTEM_PERMISSION_KEY_LIST.length) {
    errors.push(`KEY_SET size (${SYSTEM_PERMISSION_KEY_SET.size}) != KEY_LIST length (${SYSTEM_PERMISSION_KEY_LIST.length})`);
  }

  // Check required fields
  for (const p of SYSTEM_PERMISSIONS) {
    if (!p.key || !p.resource || !p.action || !p.label || !p.group) {
      errors.push(`Permission missing required fields: ${JSON.stringify(p)}`);
    }
    if (p.isSystem !== true) {
      errors.push(`Permission "${p.key}" must have isSystem: true`);
    }
  }

  // Check key format: lowercase, dot notation, no leading/trailing dots
  for (const p of SYSTEM_PERMISSIONS) {
    if (p.key !== p.key.toLowerCase()) {
      errors.push(`Key "${p.key}" must be lowercase`);
    }
    if (!p.key.includes('.')) {
      errors.push(`Key "${p.key}" must use dot notation`);
    }
    if (p.key.startsWith('.') || p.key.endsWith('.')) {
      errors.push(`Key "${p.key}" must not start or end with dot`);
    }
    // Check resource is lowercase kebab-case
    if (p.resource !== p.resource.toLowerCase()) {
      errors.push(`Resource "${p.resource}" in key "${p.key}" must be lowercase`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    totalCount: SYSTEM_PERMISSIONS.length,
  };
}

export type { SystemPermissionDefinition, SystemPermissionGroup } from './permission.types';