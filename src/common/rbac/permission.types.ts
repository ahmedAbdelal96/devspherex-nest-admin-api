/**
 * RBAC Permission Types
 *
 * Pure types with no Prisma dependencies.
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

export type PermissionResource =
  | 'auth'
  | 'users'
  | 'roles'
  | 'permissions'
  | 'audit-logs'
  | 'api-request-logs'
  | 'system'
  | 'settings';

export type PermissionGroupName =
  | 'Auth'
  | 'Users'
  | 'Roles'
  | 'Permissions'
  | 'Audit Logs'
  | 'API Request Logs'
  | 'System';

export interface SystemPermissionDefinition {
  key: string;
  resource: string;
  action: string;
  label: string;
  description?: string;
  group: string;
  isSystem: true;
}

export interface SystemPermissionGroup {
  name: string;
  permissions: SystemPermissionDefinition[];
}

export interface ValidatedPermission {
  key: string;
  isValid: boolean;
  errors: string[];
}

export interface SystemPermissionsValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  totalCount: number;
}