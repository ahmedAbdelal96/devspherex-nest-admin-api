/**
 * Permission Utility Functions
 *
 * Pure utility functions for working with permissions.
 * No database calls, no NestJS dependencies.
 */

import type {
  SystemPermissionDefinition,
  SystemPermissionGroup,
} from './permission.types';

/**
 * Flatten permission groups into a single array of permissions
 */
export function flattenPermissionGroups(
  groups: SystemPermissionGroup[],
): SystemPermissionDefinition[] {
  return groups.flatMap((group) => group.permissions);
}

/**
 * Create a Set of permission keys from an array of permissions
 */
export function createPermissionKeySet(
  permissions: SystemPermissionDefinition[],
): Set<string> {
  return new Set(permissions.map((p) => p.key));
}

/**
 * Find duplicate permission keys in an array of permissions
 * @param permissions - Array of permission definitions
 * @returns Array of duplicate keys (empty if none found)
 */
export function findDuplicatePermissionKeys(
  permissions: SystemPermissionDefinition[],
): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const permission of permissions) {
    if (seen.has(permission.key)) {
      duplicates.push(permission.key);
    } else {
      seen.add(permission.key);
    }
  }

  return duplicates;
}

/**
 * Find invalid permission definitions
 * Checks for missing required fields and malformed keys
 * @param permissions - Array of permission definitions
 * @returns Array of error messages (empty if all valid)
 */
export function findInvalidPermissionDefinitions(
  permissions: SystemPermissionDefinition[],
): string[] {
  const errors: string[] = [];

  for (const permission of permissions) {
    // Check required fields
    if (!permission.key) {
      errors.push('Permission missing required field: key');
      continue;
    }
    if (!permission.resource) {
      errors.push(`Permission "${permission.key}" missing required field: resource`);
    }
    if (!permission.action) {
      errors.push(`Permission "${permission.key}" missing required field: action`);
    }
    if (!permission.label) {
      errors.push(`Permission "${permission.key}" missing required field: label`);
    }
    if (!permission.group) {
      errors.push(`Permission "${permission.key}" missing required field: group`);
    }
    if (permission.isSystem !== true) {
      errors.push(`Permission "${permission.key}" must have isSystem: true`);
    }

    // Check key format
    if (permission.key && !permission.key.includes('.')) {
      errors.push(`Permission key "${permission.key}" must use dot notation (resource.action)`);
    }
    if (permission.key && permission.key !== permission.key.toLowerCase()) {
      errors.push(`Permission key "${permission.key}" must be lowercase`);
    }
    if (permission.key && (permission.key.startsWith('.') || permission.key.endsWith('.'))) {
      errors.push(`Permission key "${permission.key}" must not start or end with a dot`);
    }
  }

  return errors;
}

/**
 * Group permissions by their group field
 * @param permissions - Array of permission definitions
 * @returns Record of group names to arrays of permissions
 */
export function groupPermissionsByGroup(
  permissions: SystemPermissionDefinition[],
): Record<string, SystemPermissionDefinition[]> {
  return permissions.reduce(
    (acc, permission) => {
      const group = permission.group;
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(permission);
      return acc;
    },
    {} as Record<string, SystemPermissionDefinition[]>,
  );
}

/**
 * Check if a permission key is valid
 */
export function isValidPermissionKey(
  key: string,
  validKeys: Set<string> | string[],
): boolean {
  if (validKeys instanceof Set) {
    return validKeys.has(key);
  }
  return (validKeys as string[]).includes(key);
}

/**
 * Get unique resource names from a list of permissions
 * @param permissions - Array of permission definitions
 * @returns Array of unique resource names
 */
export function getUniqueResources(
  permissions: SystemPermissionDefinition[],
): string[] {
  const resources = new Set(permissions.map((p) => p.resource));
  return Array.from(resources).sort();
}

/**
 * Get unique action names from a list of permissions
 * @param permissions - Array of permission definitions
 * @returns Array of unique action names
 */
export function getUniqueActions(
  permissions: SystemPermissionDefinition[],
): string[] {
  const actions = new Set(permissions.map((p) => p.action));
  return Array.from(actions).sort();
}

/**
 * Filter permissions by resource
 * @param permissions - Array of permission definitions
 * @param resource - Resource name to filter by
 * @returns Filtered array of permissions
 */
export function filterByResource(
  permissions: SystemPermissionDefinition[],
  resource: string,
): SystemPermissionDefinition[] {
  return permissions.filter((p) => p.resource === resource);
}

/**
 * Filter permissions by action
 * @param permissions - Array of permission definitions
 * @param action - Action name to filter by
 * @returns Filtered array of permissions
 */
export function filterByAction(
  permissions: SystemPermissionDefinition[],
  action: string,
): SystemPermissionDefinition[] {
  return permissions.filter((p) => p.action === action);
}

/**
 * Search permissions by key, label, or description
 * Case-insensitive partial matching
 * @param permissions - Array of permission definitions
 * @param searchTerm - Term to search for
 * @returns Filtered array of matching permissions
 */
export function searchPermissions(
  permissions: SystemPermissionDefinition[],
  searchTerm: string,
): SystemPermissionDefinition[] {
  const term = searchTerm.toLowerCase();
  return permissions.filter(
    (p) =>
      p.key.toLowerCase().includes(term) ||
      p.label.toLowerCase().includes(term) ||
      p.description?.toLowerCase().includes(term) ||
      p.resource.toLowerCase().includes(term),
  );
}