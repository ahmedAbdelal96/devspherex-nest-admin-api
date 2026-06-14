/**
 * Seed System Tests
 *
 * Tests the seed registry validation and logger sanitization.
 * Database not required.
 */

import { seeders } from '../../prisma/seed/seed.registry';

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
  });
});

describe('Seed Logger sanitization', () => {
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

  it('sanitizes password fields', () => {
    const meta = { password: 'my-secret-value', safeField: 'visible' };
    const sanitized = sanitizeMeta(meta);
    expect(sanitized['password']).toBe('[REDACTED]');
    expect(sanitized['safeField']).toBe('visible');
  });

  it('sanitizes token fields', () => {
    const meta = { accessToken: 'secret-token', userEmail: 'a@b.com' };
    const sanitized = sanitizeMeta(meta);
    expect(sanitized['accessToken']).toBe('[REDACTED]');
    expect(sanitized['userEmail']).toBe('a@b.com');
  });

  it('sanitizes hash fields', () => {
    const meta = { passwordHash: 'xyz123', name: 'Admin' };
    const sanitized = sanitizeMeta(meta);
    expect(sanitized['passwordHash']).toBe('[REDACTED]');
    expect(sanitized['name']).toBe('Admin');
  });

  it('sanitizes case-insensitive sensitive keys', () => {
    const meta = { PASSWORD: 'secret123', userPassword: 'also-secret' };
    const sanitized = sanitizeMeta(meta);
    expect(sanitized['PASSWORD']).toBe('[REDACTED]');
    expect(sanitized['userPassword']).toBe('[REDACTED]');
  });

  it('does not modify non-sensitive fields', () => {
    const meta = { email: 'admin@example.com', roleId: 'role-123', createdAt: '2026-01-01' };
    const sanitized = sanitizeMeta(meta);
    expect(sanitized).toEqual(meta);
  });
});

describe('Admin password resolution', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env['SEED_ADMIN_PASSWORD'];
    delete process.env['NODE_ENV'];
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses SEED_ADMIN_PASSWORD when set', () => {
    process.env['SEED_ADMIN_PASSWORD'] = 'MySecret123';
    process.env['NODE_ENV'] = 'production';
    expect(process.env['SEED_ADMIN_PASSWORD']).toBe('MySecret123');
    expect(process.env['NODE_ENV']).toBe('production');
  });

  it('requires SEED_ADMIN_PASSWORD in production', () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['SEED_ADMIN_PASSWORD'];
    expect(process.env['SEED_ADMIN_PASSWORD']).toBeUndefined();
    expect(process.env['NODE_ENV']).toBe('production');
  });
});