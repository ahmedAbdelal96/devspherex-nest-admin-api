/**
 * Audit Action Registry
 *
 * Central registry of all audit action strings.
 * Use these constants when calling AuditLogService.log().
 *
 * Format: dot/kebab notation — resource.verb or resource.sub-resource.verb
 *
 * Rules:
 * - All lowercase
 * - No duplicate values
 * - Stable names (never change after release)
 * - No passwords, tokens, or secrets in action names
 */

export const AUDIT_ACTIONS = {
  // ── Users ────────────────────────────────────────────────────────────────
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',
  USERS_DISABLE: 'users.disable',
  USERS_ENABLE: 'users.enable',
  USERS_UPDATE_ROLE: 'users.update-role',
  USERS_UPDATE_STATUS: 'users.update-status',
  USERS_PERMISSIONS_OVERRIDE: 'users.permissions-override',

  // ── Roles ────────────────────────────────────────────────────────────────
  ROLES_CREATE: 'roles.create',
  ROLES_UPDATE: 'roles.update',
  ROLES_DELETE: 'roles.delete',
  ROLES_DISABLE: 'roles.disable',
  ROLES_UPDATE_PERMISSIONS: 'roles.update-permissions',
  ROLES_DUPLICATE: 'roles.duplicate',

  // ── Auth / Security ─────────────────────────────────────────────────────
  AUTH_PASSWORD_CHANGE: 'auth.password-change',
  AUTH_LOGOUT_ALL: 'auth.logout-all',
  AUTH_PASSWORD_RESET_SUCCESS: 'auth.password-reset-success',
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_REGISTER: 'auth.register',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/**
 * Verify no duplicate values exist in AUDIT_ACTIONS.
 * Throws at import time if duplicates are found.
 */
function assertNoDuplicateActions(): void {
  const values = Object.values(AUDIT_ACTIONS);
  const seen = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) {
      throw new Error(`Duplicate audit action value: "${v}"`);
    }
    seen.add(v);
  }
}
assertNoDuplicateActions();
