/**
 * RBAC Permission Types
 *
 * These types define the structure for system permissions.
 * They are designed to match the Prisma Permission model fields.
 *
 * IMPORTANT: These types are pure and have no Prisma dependencies.
 * This layer must stay reusable without database coupling.
 */

/**
 * Permission action types
 */
export type PermissionAction =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'status.update'
  | 'role.update'
  | 'permissions.read'
  | 'permissions.override'
  | 'permissions.update'
  | 'grouped.read'
  | 'duplicate'
  | 'health.read'
  | 'password.change';

/**
 * Permission resource types
 */
export type PermissionResource =
  | 'auth'
  | 'users'
  | 'roles'
  | 'permissions'
  | 'auditLogs'
  | 'apiRequestLogs'
  | 'system'
  | 'settings';

/**
 * Permission group names
 */
export type PermissionGroupName =
  | 'Auth'
  | 'Users'
  | 'Roles'
  | 'Permissions'
  | 'Audit Logs'
  | 'API Request Logs'
  | 'System';

/**
 * Core permission definition interface
 * Matches Prisma Permission model fields
 */
export interface SystemPermissionDefinition {
  /** Unique permission key in dot notation (e.g., "users.read") */
  key: string;
  /** Resource name (e.g., "users") */
  resource: string;
  /** Action name (e.g., "read") */
  action: string;
  /** Human-readable label for UI */
  label: string;
  /** Optional description of what the permission allows */
  description?: string;
  /** Group name for organizing permissions (e.g., "Users") */
  group: string;
  /** Whether this is a system permission (cannot be deleted) */
  isSystem: true;
}

/**
 * Permission group structure
 * Contains all permissions for a specific group
 */
export interface SystemPermissionGroup {
  /** Group name */
  name: string;
  /** Permissions within this group */
  permissions: SystemPermissionDefinition[];
}

/**
 * Permission key type for type-safe key access
 * This is a string literal type derived from permission keys
 */
export type SystemPermissionKey = string;

/**
 * Record type for quick permission lookup by key
 */
export type SystemPermissionKeyRecord = Record<SystemPermissionKey, SystemPermissionDefinition>;

/**
 * Validated permission that has been checked for duplicates and structure
 */
export interface ValidatedPermission {
  key: string;
  isValid: boolean;
  errors: string[];
}

/**
 * Validation result for the entire permission system
 */
export interface SystemPermissionsValidationResult {
  /** Whether all permissions are valid */
  isValid: boolean;
  /** Any errors found during validation */
  errors: string[];
  /** Warnings that don't prevent usage */
  warnings: string[];
  /** Total permission count */
  totalCount: number;
}