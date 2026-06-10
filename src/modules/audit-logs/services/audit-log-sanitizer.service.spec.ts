/**
 * Audit Log Sanitizer — Unit Tests
 *
 * Verifies that sensitive keys are redacted recursively from objects
 * before they are stored in audit log records.
 */

import { sanitizeAuditData } from './audit-log-sanitizer.service';

describe('AuditLogSanitizer', () => {
  describe('top-level sensitive keys', () => {
    it('redacts password', () => {
      const input = { email: 'a@test.com', password: 'SuperSecret123' };
      const result = sanitizeAuditData(input) as Record<string, unknown>;
      expect(result['email']).toBe('a@test.com');
      expect(result['password']).toBe('<redacted>');
    });

    it('redacts accessToken', () => {
      const input = { userId: 'u1', accessToken: 'tok_abc123' };
      const result = sanitizeAuditData(input) as Record<string, unknown>;
      expect(result['userId']).toBe('u1');
      expect(result['accessToken']).toBe('<redacted>');
    });

    it('redacts refreshToken', () => {
      const input = { userId: 'u1', refreshToken: 'rt_xyz' };
      const result = sanitizeAuditData(input) as Record<string, unknown>;
      expect(result['refreshToken']).toBe('<redacted>');
    });

    it('redacts token', () => {
      const input = { action: 'login', token: 'secret-token' };
      const result = sanitizeAuditData(input) as Record<string, unknown>;
      expect(result['token']).toBe('<redacted>');
    });

    it('redacts otp', () => {
      const input = { userId: 'u1', otp: '123456' };
      const result = sanitizeAuditData(input) as Record<string, unknown>;
      expect(result['otp']).toBe('<redacted>');
    });

    it('redacts authorization header', () => {
      const input = { path: '/api', authorization: 'Bearer secret' };
      const result = sanitizeAuditData(input) as Record<string, unknown>;
      expect(result['authorization']).toBe('<redacted>');
    });

    it('redacts cookie', () => {
      const input = { path: '/api', cookie: 'session=abc123' };
      const result = sanitizeAuditData(input) as Record<string, unknown>;
      expect(result['cookie']).toBe('<redacted>');
    });
  });

  describe('nested sensitive keys', () => {
    it('redacts nested tokenHash', () => {
      const input = {
        user: { id: 'u1', tokenHash: 'abc_hash' },
      };
      const result = sanitizeAuditData(input) as Record<string, unknown>;
      const user = result['user'] as Record<string, unknown>;
      expect(user['id']).toBe('u1');
      expect(user['tokenHash']).toBe('<redacted>');
    });

    it('redacts deeply nested password', () => {
      const input = {
        profile: {
          credentials: { password: 'secret123' },
        },
      };
      const result = sanitizeAuditData(input) as Record<string, unknown>;
      const profile = result['profile'] as Record<string, unknown>;
      const credentials = profile['credentials'] as Record<string, unknown>;
      expect(credentials['password']).toBe('<redacted>');
    });

    it('redacts nested otpHash', () => {
      const input = {
        challenge: {
          otpHash: 'hash_value',
        },
      };
      const result = sanitizeAuditData(input) as Record<string, unknown>;
      const challenge = result['challenge'] as Record<string, unknown>;
      expect(challenge['otpHash']).toBe('<redacted>');
    });
  });

  describe('arrays', () => {
    it('redacts sensitive keys inside array objects', () => {
      const input = {
        users: [
          { id: 'u1', password: 'pass1' },
          { id: 'u2', password: 'pass2' },
        ],
      };
      const result = sanitizeAuditData(input) as Record<string, unknown>;
      const users = result['users'] as Array<Record<string, unknown>>;
      expect(users[0]['id']).toBe('u1');
      expect(users[0]['password']).toBe('<redacted>');
      expect(users[1]['id']).toBe('u2');
      expect(users[1]['password']).toBe('<redacted>');
    });

    it('returns primitive arrays unchanged', () => {
      const input = ['admin', 'editor', 'viewer'];
      const result = sanitizeAuditData(input);
      expect(result).toEqual(['admin', 'editor', 'viewer']);
    });
  });

  describe('null and primitives', () => {
    it('returns null unchanged', () => {
      expect(sanitizeAuditData(null)).toBeNull();
    });

    it('returns undefined unchanged', () => {
      expect(sanitizeAuditData(undefined)).toBeUndefined();
    });

    it('returns string unchanged', () => {
      expect(sanitizeAuditData('hello world')).toBe('hello world');
    });

    it('returns number unchanged', () => {
      expect(sanitizeAuditData(42)).toBe(42);
    });

    it('returns boolean unchanged', () => {
      expect(sanitizeAuditData(true)).toBe(true);
    });
  });

  describe('case-insensitive matching', () => {
    it('redacts PASSWORD (uppercase)', () => {
      const input = { PASSWORD: 'secret' };
      const result = sanitizeAuditData(input) as Record<string, unknown>;
      expect(result['PASSWORD']).toBe('<redacted>');
    });

    it('redacts Password (mixed case)', () => {
      const input = { Password: 'secret' };
      const result = sanitizeAuditData(input) as Record<string, unknown>;
      expect(result['Password']).toBe('<redacted>');
    });

    it('redacts TOKENHASH (uppercase)', () => {
      const input = { TOKENHASH: 'hash' };
      const result = sanitizeAuditData(input) as Record<string, unknown>;
      expect(result['TOKENHASH']).toBe('<redacted>');
    });
  });

  describe('original object immutability', () => {
    it('does not mutate the original object', () => {
      const original = { password: 'secret123', email: 'a@test.com' };
      const originalCopy = { ...original };
      sanitizeAuditData(original);
      expect(original).toEqual(originalCopy);
    });

    it('does not mutate nested original objects', () => {
      const original = {
        user: { password: 'secret', name: 'John' },
      };
      const originalUser = { ...original.user };
      sanitizeAuditData(original);
      expect(original.user).toEqual(originalUser);
    });
  });

  describe('non-sensitive keys', () => {
    it('preserves regular fields', () => {
      const input = {
        id: 'u1',
        email: 'a@test.com',
        name: 'John',
        status: 'ACTIVE',
      };
      const result = sanitizeAuditData(input) as Record<string, unknown>;
      expect(result['id']).toBe('u1');
      expect(result['email']).toBe('a@test.com');
      expect(result['name']).toBe('John');
      expect(result['status']).toBe('ACTIVE');
    });

    it('preserves nested non-sensitive fields', () => {
      const input = {
        user: { id: 'u1', name: 'John', email: 'a@test.com' },
      };
      const result = sanitizeAuditData(input) as Record<string, unknown>;
      const user = result['user'] as Record<string, unknown>;
      expect(user['id']).toBe('u1');
      expect(user['name']).toBe('John');
      expect(user['email']).toBe('a@test.com');
    });
  });
});
