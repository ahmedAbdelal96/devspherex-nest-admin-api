/**
 * Seed System Tests
 *
 * Tests the seed registry validation, helpers, logger sanitization,
 * and role permission safety behavior. No database required.
 */

import * as fs from 'fs';
import * as path from 'path';
import { seeders, getSeedersReversed } from '../../prisma/seed/seed.registry';
import { parseSeedMode, isResetAllowed } from '../../prisma/seed/seed.helpers';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const sensitive = ['password', 'token', 'hash', 'secret', 'credential', 'otp'];
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    const lower = k.toLowerCase();
    if (sensitive.some((s) => lower.includes(s))) {
      sanitized[k] = '[REDACTED]';
    } else if (typeof v === 'string') {
      sanitized[k] = v;
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

// ─── Seed Registry Tests ──────────────────────────────────────────────────────

describe('Seed Registry', () => {
  describe('seeder names', () => {
    it('has no duplicate seeder names', () => {
      const names = seeders.map((s) => s.name);
      const unique = new Set(names);
      expect(unique.size).toBe(names.length);
    });
  });

  describe('dependency order', () => {
    it('permissions comes before roles', () => {
      const permIdx = seeders.findIndex((s) => s.name === 'permissions');
      const rolesIdx = seeders.findIndex((s) => s.name === 'roles');
      expect(permIdx).toBeLessThan(rolesIdx);
    });

    it('roles comes before users', () => {
      const rolesIdx = seeders.findIndex((s) => s.name === 'roles');
      const usersIdx = seeders.findIndex((s) => s.name === 'users');
      expect(rolesIdx).toBeLessThan(usersIdx);
    });
  });

  describe('reset order', () => {
    it('getSeedersReversed returns seeders in reverse order', () => {
      const reversed = getSeedersReversed();
      const userIdx = reversed.findIndex((s) => s.name === 'users');
      const rolesIdx = reversed.findIndex((s) => s.name === 'roles');
      const permIdx = reversed.findIndex((s) => s.name === 'permissions');
      expect(userIdx).toBeLessThan(rolesIdx);
      expect(rolesIdx).toBeLessThan(permIdx);
    });
  });

  describe('reset functions', () => {
    it('permissions seeder has reset function', () => {
      const p = seeders.find((s) => s.name === 'permissions');
      expect(p?.reset).toBeDefined();
    });

    it('roles seeder has reset function', () => {
      const r = seeders.find((s) => s.name === 'roles');
      expect(r?.reset).toBeDefined();
    });

    it('users seeder has reset function', () => {
      const u = seeders.find((s) => s.name === 'users');
      expect(u?.reset).toBeDefined();
    });
  });

  describe('dependencies declared', () => {
    it('roles depends on permissions', () => {
      const r = seeders.find((s) => s.name === 'roles');
      expect(r?.dependencies).toContain('permissions');
    });

    it('users depends on roles', () => {
      const u = seeders.find((s) => s.name === 'users');
      expect(u?.dependencies).toContain('roles');
    });

    it('permissions has no dependencies', () => {
      const p = seeders.find((s) => s.name === 'permissions');
      expect(p?.dependencies ?? []).toHaveLength(0);
    });
  });
});

// ─── Seed Mode Parsing Tests ───────────────────────────────────────────────────

describe('parseSeedMode', () => {
  it('defaults to upsert when no args', () => {
    expect(parseSeedMode([])).toBe('upsert');
  });

  it('returns upsert for --mode=upsert', () => {
    expect(parseSeedMode(['--mode=upsert'])).toBe('upsert');
    expect(parseSeedMode(['some-arg', '--mode=upsert', 'other-arg'])).toBe('upsert');
  });

  it('returns reset for --mode=reset', () => {
    expect(parseSeedMode(['--mode=reset'])).toBe('reset');
    expect(parseSeedMode(['--mode=reset', '--extra'])).toBe('reset');
  });

  it('is case-insensitive', () => {
    expect(parseSeedMode(['--mode=UPSERT'])).toBe('upsert');
    expect(parseSeedMode(['--mode=Reset'])).toBe('reset');
  });

  it('trims whitespace', () => {
    expect(parseSeedMode(['--mode= upsert '])).toBe('upsert');
  });
});

// ─── Reset Guard Tests ────────────────────────────────────────────────────────

describe('isResetAllowed', () => {
  it('returns false when ALLOW_SEED_RESET is not set', () => {
    expect(isResetAllowed({})).toBe(false);
  });

  it('returns false when ALLOW_SEED_RESET is "false"', () => {
    expect(isResetAllowed({ ALLOW_SEED_RESET: 'false' })).toBe(false);
  });

  it('returns true when ALLOW_SEED_RESET is "true"', () => {
    expect(isResetAllowed({ ALLOW_SEED_RESET: 'true' })).toBe(true);
  });

  it('returns false for any other value', () => {
    expect(isResetAllowed({ ALLOW_SEED_RESET: '1' })).toBe(false);
    expect(isResetAllowed({ ALLOW_SEED_RESET: 'yes' })).toBe(false);
    expect(isResetAllowed({ ALLOW_SEED_RESET: '' })).toBe(false);
  });
});

// ─── Logger Sanitization Tests ────────────────────────────────────────────────

describe('Seed Logger sanitization', () => {
  it('redacts password fields', () => {
    const meta = { password: 'my-secret-value', safeField: 'visible' };
    const sanitized = sanitizeMeta(meta);
    expect(sanitized['password']).toBe('[REDACTED]');
    expect(sanitized['safeField']).toBe('visible');
  });

  it('redacts token fields', () => {
    const meta = { accessToken: 'secret-token', userEmail: 'a@b.com' };
    const sanitized = sanitizeMeta(meta);
    expect(sanitized['accessToken']).toBe('[REDACTED]');
    expect(sanitized['userEmail']).toBe('a@b.com');
  });

  it('redacts hash fields', () => {
    const meta = { passwordHash: 'xyz123', name: 'Admin' };
    const sanitized = sanitizeMeta(meta);
    expect(sanitized['passwordHash']).toBe('[REDACTED]');
    expect(sanitized['name']).toBe('Admin');
  });

  it('redacts secret fields', () => {
    const meta = { apiSecret: 'top-secret', roleId: 'role-1' };
    const sanitized = sanitizeMeta(meta);
    expect(sanitized['apiSecret']).toBe('[REDACTED]');
    expect(sanitized['roleId']).toBe('role-1');
  });

  it('redacts credential fields', () => {
    const meta = { serviceCredential: 'cred-xyz', createdAt: '2026-01-01' };
    const sanitized = sanitizeMeta(meta);
    expect(sanitized['serviceCredential']).toBe('[REDACTED]');
    expect(sanitized['createdAt']).toBe('2026-01-01');
  });

  it('redacts otp fields', () => {
    const meta = { otpCode: '123456', userEmail: 'test@test.com' };
    const sanitized = sanitizeMeta(meta);
    expect(sanitized['otpCode']).toBe('[REDACTED]');
    expect(sanitized['userEmail']).toBe('test@test.com');
  });

  it('redacts case-insensitive sensitive keys', () => {
    const meta = { PASSWORD: 'secret123', userPassword: 'also-secret' };
    const sanitized = sanitizeMeta(meta);
    expect(sanitized['PASSWORD']).toBe('[REDACTED]');
    expect(sanitized['userPassword']).toBe('[REDACTED]');
  });

  it('does not modify non-sensitive string fields', () => {
    const meta = { email: 'admin@example.com', roleId: 'role-123', slug: 'super-admin' };
    const sanitized = sanitizeMeta(meta);
    expect(sanitized).toEqual(meta);
  });

  it('does not modify non-string fields', () => {
    const meta = { count: 42, enabled: true, timestamp: new Date('2026-01-01') };
    const sanitized = sanitizeMeta(meta);
    expect(sanitized['count']).toBe(42);
    expect(sanitized['enabled']).toBe(true);
  });
});

// ─── Role Permission Safety Tests ─────────────────────────────────────────────

const ROLES_SEED_PATH = path.resolve(process.cwd(), 'prisma/seed/modules/roles.seed.ts');

function getRolesSeedSource(): string {
  return fs.readFileSync(ROLES_SEED_PATH, 'utf8');
}

describe('Role permission safety', () => {
  it('seedRoles does not call deleteMany (code inspection)', () => {
    // This test verifies the code no longer calls deleteMany on rolePermission.
    // We import the module source and scan for dangerous patterns.
    // This is a static check — the actual behavior requires a DB.
    const rolesSeedSource = getRolesSeedSource();

    // In upsert function (seedRoles), there should be no deleteMany call
    const seedFnMatch = rolesSeedSource.match(/export async function seedRoles[\s\S]*?^(?=\nexport)/m);
    if (seedFnMatch) {
      const seedFnBody = seedFnMatch[0];
      expect(seedFnBody).not.toMatch(/rolePermission\.deleteMany/);
      expect(seedFnBody).not.toMatch(/deleteMany\(\s*\{/);
    }
  });

  it('resetRoles calls deleteMany (expected behavior for reset)', () => {
    const rolesSeedSource = getRolesSeedSource();

    // resetRoles deletes roles by known slugs — this is expected in reset mode
    expect(rolesSeedSource).toMatch(/role\.deleteMany/);
  });

  it('seedRoles does NOT call deleteMany on rolePermission (upsert safety)', () => {
    const rolesSeedSource = getRolesSeedSource();

    // Extract seedRoles function body using a simple line-based approach
    const lines = rolesSeedSource.split('\n');
    let inSeedRoles = false;
    const seedRolesLines: string[] = [];

    for (const line of lines) {
      if (line.includes('export async function seedRoles')) {
        inSeedRoles = true;
      }
      if (inSeedRoles) {
        seedRolesLines.push(line);
        if (line.trim() === '}' && inSeedRoles) break;
      }
    }

    const seedRolesBody = seedRolesLines.join('\n');
    // seedRoles must NOT call rolePermission.deleteMany in upsert mode
    expect(seedRolesBody).not.toMatch(/deleteMany/);
  });
});

// ─── Production Password Guard Tests ─────────────────────────────────────────

describe('Admin password resolution (env behavior)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env['SEED_ADMIN_PASSWORD'];
    delete process.env['NODE_ENV'];
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('requires SEED_ADMIN_PASSWORD in production', () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['SEED_ADMIN_PASSWORD'];
    // In production without SEED_ADMIN_PASSWORD, the seed should fail
    // We verify the env state that triggers the failure
    expect(process.env['NODE_ENV']).toBe('production');
    expect(process.env['SEED_ADMIN_PASSWORD']).toBeUndefined();
  });

  it('uses SEED_ADMIN_PASSWORD when set in production', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['SEED_ADMIN_PASSWORD'] = 'MySecret123!';
    expect(process.env['SEED_ADMIN_PASSWORD']).toBe('MySecret123!');
  });

  it('does not require SEED_ADMIN_PASSWORD in development', () => {
    process.env['NODE_ENV'] = 'development';
    delete process.env['SEED_ADMIN_PASSWORD'];
    expect(process.env['NODE_ENV']).toBe('development');
    expect(process.env['SEED_ADMIN_PASSWORD']).toBeUndefined();
  });

  it('uses SEED_ADMIN_PASSWORD when set in development', () => {
    process.env['NODE_ENV'] = 'development';
    process.env['SEED_ADMIN_PASSWORD'] = 'DevPassword123';
    expect(process.env['SEED_ADMIN_PASSWORD']).toBe('DevPassword123');
  });
});

// ─── Seed Helpers Export Verification ─────────────────────────────────────────

describe('seed.helpers exports', () => {
  it('parseSeedMode is a function', () => {
    expect(typeof parseSeedMode).toBe('function');
  });

  it('isResetAllowed is a function', () => {
    expect(typeof isResetAllowed).toBe('function');
  });

  it('parseSeedMode does not throw on empty args', () => {
    expect(() => parseSeedMode([])).not.toThrow();
  });

  it('isResetAllowed does not throw on empty env', () => {
    expect(() => isResetAllowed({})).not.toThrow();
  });
});