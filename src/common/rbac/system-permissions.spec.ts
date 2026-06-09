/**
 * System Permissions — Unit Tests
 *
 * Tests pure validation functions from system-permissions.ts.
 */

import {
  SYSTEM_PERMISSION_KEYS,
  SYSTEM_PERMISSION_KEY_LIST,
  SYSTEM_PERMISSION_KEY_SET,
  getSystemPermissionByKey,
  getPermissionsByGroup,
  assertValidSystemPermissionKey,
  validateSystemPermissions,
} from './system-permissions';

describe('SYSTEM_PERMISSION_KEYS', () => {
  it('contains all expected resource namespaces', () => {
    expect(SYSTEM_PERMISSION_KEYS.AUTH).toBeDefined();
    expect(SYSTEM_PERMISSION_KEYS.USERS).toBeDefined();
    expect(SYSTEM_PERMISSION_KEYS.ROLES).toBeDefined();
    expect(SYSTEM_PERMISSION_KEYS.PERMISSIONS).toBeDefined();
    expect(SYSTEM_PERMISSION_KEYS.AUDIT_LOGS).toBeDefined();
    expect(SYSTEM_PERMISSION_KEYS.API_REQUEST_LOGS).toBeDefined();
    expect(SYSTEM_PERMISSION_KEYS.SYSTEM).toBeDefined();
    expect(SYSTEM_PERMISSION_KEYS.SETTINGS).toBeDefined();
  });

  it('all keys use dot notation', () => {
    const keys = Object.values(SYSTEM_PERMISSION_KEYS).map((ns) =>
      Object.values(ns as object),
    ).flat();
    for (const key of keys) {
      expect(key).toMatch(/\w+\.\w+/);
    }
  });

  it('all keys are lowercase', () => {
    const keys = Object.values(SYSTEM_PERMISSION_KEYS).map((ns) =>
      Object.values(ns as object),
    ).flat();
    for (const key of keys) {
      expect(key).toBe(key.toLowerCase());
    }
  });
});

describe('SYSTEM_PERMISSION_KEY_LIST', () => {
  it('has 24 permissions', () => {
    expect(SYSTEM_PERMISSION_KEY_LIST).toHaveLength(24);
  });

  it('has no duplicates', () => {
    const unique = new Set(SYSTEM_PERMISSION_KEY_LIST);
    expect(unique.size).toBe(SYSTEM_PERMISSION_KEY_LIST.length);
  });
});

describe('SYSTEM_PERMISSION_KEY_SET', () => {
  it('size matches LIST length', () => {
    expect(SYSTEM_PERMISSION_KEY_SET.size).toBe(SYSTEM_PERMISSION_KEY_LIST.length);
  });

  it('has("users.read")', () => {
    expect(SYSTEM_PERMISSION_KEY_SET.has('users.read')).toBe(true);
  });

  it('does not have("fake.key")', () => {
    expect(SYSTEM_PERMISSION_KEY_SET.has('fake.key' as never)).toBe(false);
  });
});

describe('getSystemPermissionByKey', () => {
  it('finds existing key', () => {
    const def = getSystemPermissionByKey('users.read');
    expect(def).toBeDefined();
    expect(def?.key).toBe('users.read');
    expect(def?.resource).toBe('users');
    expect(def?.action).toBe('read');
  });

  it('returns undefined for unknown key', () => {
    expect(getSystemPermissionByKey('fake.key')).toBeUndefined();
  });
});

describe('getPermissionsByGroup', () => {
  it('returns permissions for "Users" group', () => {
    const perms = getPermissionsByGroup('Users');
    expect(perms.length).toBeGreaterThan(0);
    expect(perms.every((p) => p.group === 'Users')).toBe(true);
  });

  it('returns empty array for unknown group', () => {
    expect(getPermissionsByGroup('FakeGroup')).toEqual([]);
  });
});

describe('assertValidSystemPermissionKey', () => {
  it('does not throw for valid key', () => {
    expect(() => assertValidSystemPermissionKey('users.read')).not.toThrow();
  });

  it('throws for invalid key', () => {
    expect(() => assertValidSystemPermissionKey('fake.key')).toThrow('Invalid permission key');
  });
});

describe('validateSystemPermissions', () => {
  it('returns isValid=true for the baseline', () => {
    const result = validateSystemPermissions();
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('totalCount is 24', () => {
    const result = validateSystemPermissions();
    expect(result.totalCount).toBe(24);
  });
});
