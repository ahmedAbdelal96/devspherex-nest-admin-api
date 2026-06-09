/**
 * RBAC Types
 *
 * Types for RBAC decorators and guards.
 */

export type PermissionMode = 'all' | 'any';

export interface RequiredPermissionsMetadata {
  permissions: string[];
  mode: PermissionMode;
}

export interface AuthenticatedRouteMetadata {
  required: true;
}