/**
 * Audit Resource Type Registry
 *
 * Central registry of all resource types that can appear in audit logs.
 * Use these constants as the `resourceType` field when calling AuditLogService.log().
 *
 * Rules:
 * - PascalCase singular (matches Prisma model naming convention)
 * - No duplicate values
 * - Stable names
 */

export const AUDIT_RESOURCE_TYPES = {
  USER: 'User',
  ROLE: 'Role',
  PERMISSION: 'Permission',
  AUTH_SESSION: 'AuthSession',
  PASSWORD_RECOVERY: 'PasswordRecovery',
} as const;

export type AuditResourceType =
  (typeof AUDIT_RESOURCE_TYPES)[keyof typeof AUDIT_RESOURCE_TYPES];

/**
 * Verify no duplicate values exist in AUDIT_RESOURCE_TYPES.
 */
function assertNoDuplicateResourceTypes(): void {
  const values = Object.values(AUDIT_RESOURCE_TYPES);
  const seen = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) {
      throw new Error(`Duplicate audit resource type value: "${v}"`);
    }
    seen.add(v);
  }
}
assertNoDuplicateResourceTypes();
