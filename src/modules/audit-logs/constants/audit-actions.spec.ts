/**
 * Audit Action & Resource Type Registry — Unit Tests
 *
 * Verifies:
 * - No duplicate action values
 * - All actions are lowercase dot/kebab strings
 * - No duplicate resource type values
 * - All resource types are stable PascalCase strings
 */

import { AUDIT_ACTIONS } from './audit-actions';
import { AUDIT_RESOURCE_TYPES } from './audit-resource-types';

describe('Audit Action Registry', () => {
  it('has no duplicate action values', () => {
    const values = Object.values(AUDIT_ACTIONS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('all actions are lowercase dot/kebab strings', () => {
    for (const value of Object.values(AUDIT_ACTIONS)) {
      expect(value).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)*$/);
 }
  });

  it('all actions contain a dot', () => {
    for (const value of Object.values(AUDIT_ACTIONS)) {
      expect(value).toContain('.');
    }
  });

  it('no action is an empty string', () => {
    for (const value of Object.values(AUDIT_ACTIONS)) {
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('includes expected user actions', () => {
    expect(AUDIT_ACTIONS.USERS_CREATE).toBe('users.create');
    expect(AUDIT_ACTIONS.USERS_UPDATE).toBe('users.update');
    expect(AUDIT_ACTIONS.USERS_UPDATE_ROLE).toBe('users.update-role');
    expect(AUDIT_ACTIONS.USERS_UPDATE_STATUS).toBe('users.update-status');
    expect(AUDIT_ACTIONS.USERS_PERMISSIONS_OVERRIDE).toBe('users.permissions-override');
  });

  it('includes expected role actions', () => {
    expect(AUDIT_ACTIONS.ROLES_CREATE).toBe('roles.create');
    expect(AUDIT_ACTIONS.ROLES_UPDATE).toBe('roles.update');
    expect(AUDIT_ACTIONS.ROLES_DELETE).toBe('roles.delete');
    expect(AUDIT_ACTIONS.ROLES_UPDATE_PERMISSIONS).toBe('roles.update-permissions');
  });

  it('includes expected auth actions', () => {
    expect(AUDIT_ACTIONS.AUTH_PASSWORD_CHANGE).toBe('auth.password-change');
    expect(AUDIT_ACTIONS.AUTH_LOGOUT_ALL).toBe('auth.logout-all');
    expect(AUDIT_ACTIONS.AUTH_PASSWORD_RESET_SUCCESS).toBe('auth.password-reset-success');
  });
});

describe('Audit Resource Type Registry', () => {
  it('has no duplicate resource type values', () => {
    const values = Object.values(AUDIT_RESOURCE_TYPES);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('all resource types are PascalCase', () => {
    for (const value of Object.values(AUDIT_RESOURCE_TYPES)) {
      expect(value).toMatch(/^[A-Z][a-zA-Z]*$/);
    }
  });

  it('includes expected resource types', () => {
    expect(AUDIT_RESOURCE_TYPES.USER).toBe('User');
    expect(AUDIT_RESOURCE_TYPES.ROLE).toBe('Role');
    expect(AUDIT_RESOURCE_TYPES.AUTH_SESSION).toBe('AuthSession');
  });
});
