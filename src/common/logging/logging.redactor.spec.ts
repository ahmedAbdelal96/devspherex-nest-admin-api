/**
 * Logging Redactor Tests
 *
 * Tests sensitive data redaction in the logging redactor.
 */

import {
  redactSensitiveData,
  isSensitiveKeyPattern,
  SENSITIVE_PATTERNS_LIST,
} from './logging.redactor';

describe('redactSensitiveData', () => {
  it('returns primitives as-is', () => {
    expect(redactSensitiveData(null)).toBeNull();
    expect(redactSensitiveData(undefined)).toBeUndefined();
    expect(redactSensitiveData(42)).toBe(42);
    expect(redactSensitiveData('hello')).toBe('hello');
    expect(redactSensitiveData(true)).toBe(true);
  });

  it('redacts password fields at top level', () => {
    const input = { username: 'admin', password: 'secret123' };
    const result = redactSensitiveData(input);
    expect(result['username']).toBe('admin');
    expect(result['password']).toBe('[REDACTED]');
  });

  it('redacts token fields at top level', () => {
    const input = { accessToken: 'tok123', refreshToken: 'ref456' };
    const result = redactSensitiveData(input);
    expect(result['accessToken']).toBe('[REDACTED]');
    expect(result['refreshToken']).toBe('[REDACTED]');
  });

  it('redacts authorization header', () => {
    const input = { authorization: 'Bearer xyz123' };
    const result = redactSensitiveData(input);
    expect(result['authorization']).toBe('[REDACTED]');
  });

  it('redacts cookie fields', () => {
    const input = { cookie: 'session=abc', cookies: 'foo=bar' };
    const result = redactSensitiveData(input);
    expect(result['cookie']).toBe('[REDACTED]');
    expect(result['cookies']).toBe('[REDACTED]');
  });

  it('redacts otp fields', () => {
    const input = { otp: '123456', otpCode: '654321' };
    const result = redactSensitiveData(input);
    expect(result['otp']).toBe('[REDACTED]');
    expect(result['otpCode']).toBe('[REDACTED]');
  });

  it('redacts resetToken fields', () => {
    const input = { resetToken: 'reset123', reset_token: '456' };
    const result = redactSensitiveData(input);
    expect(result['resetToken']).toBe('[REDACTED]');
    expect(result['reset_token']).toBe('[REDACTED]');
  });

  it('redacts passwordHash fields', () => {
    const input = { passwordHash: 'hashxyz', passwordhash: 'abc' };
    const result = redactSensitiveData(input);
    expect(result['passwordHash']).toBe('[REDACTED]');
    expect(result['passwordhash']).toBe('[REDACTED]');
  });

  it('redacts nested objects', () => {
    const input = {
      user: {
        name: 'Alice',
        password: 'secret',
        profile: { apiKey: 'key123' },
      },
    };
    const result = redactSensitiveData(input) as typeof input;
    expect(result.user.name).toBe('Alice');
    expect(result.user.password).toBe('[REDACTED]');
    expect(result.user.profile.apiKey).toBe('[REDACTED]');
  });

  it('redacts arrays', () => {
    const input = {
      users: [
        { name: 'Alice', password: 'pw1' },
        { name: 'Bob', password: 'pw2' },
      ],
    };
    const result = redactSensitiveData(input) as typeof input;
    expect(result.users[0].name).toBe('Alice');
    expect(result.users[0].password).toBe('[REDACTED]');
    expect(result.users[1].password).toBe('[REDACTED]');
  });

  it('redacts deeply nested structures', () => {
    const input = {
      level1: {
        level2: {
          level3: {
            secret: 'deep-secret',
            token: 'deep-token',
          },
        },
      },
    };
    const result = redactSensitiveData(input) as typeof input;
    expect(result.level1.level2.level3.secret).toBe('[REDACTED]');
    expect(result.level1.level2.level3.token).toBe('[REDACTED]');
  });

  it('does not mutate the original object', () => {
    const original = { password: 'secret', name: 'Alice' };
    redactSensitiveData(original);
    expect(original.password).toBe('secret');
    expect(original.name).toBe('Alice');
  });

  it('redacts credential fields', () => {
    const input = { credential: 'cred123', credentials: ['a', 'b'] };
    const result = redactSensitiveData(input);
    expect(result['credential']).toBe('[REDACTED]');
    expect(result['credentials']).toBe('[REDACTED]');
  });

  it('redacts session/cookie-related fields', () => {
    const input = { session: 'sess123', sessions: ['s1', 's2'] };
    const result = redactSensitiveData(input);
    expect(result['session']).toBe('[REDACTED]');
    expect(result['sessions']).toBe('[REDACTED]');
  });

  it('redacts apiKey and api_key', () => {
    const input = { apiKey: 'key1', api_key: 'key2' };
    const result = redactSensitiveData(input);
    expect(result['apiKey']).toBe('[REDACTED]');
    expect(result['api_key']).toBe('[REDACTED]');
  });

  it('redacts jwt and bearer fields', () => {
    const input = { jwt: 'token.jwt', bearer: 'tok' };
    const result = redactSensitiveData(input);
    expect(result['jwt']).toBe('[REDACTED]');
    expect(result['bearer']).toBe('[REDACTED]');
  });

  it('keeps safe fields intact', () => {
    const input = {
      id: 'user-1',
      email: 'alice@example.com',
      name: 'Alice',
      roleId: 'role-1',
      status: 'ACTIVE',
    };
    const result = redactSensitiveData(input);
    expect(result['id']).toBe('user-1');
    expect(result['email']).toBe('alice@example.com');
    expect(result['name']).toBe('Alice');
    expect(result['roleId']).toBe('role-1');
    expect(result['status']).toBe('ACTIVE');
  });

  it('handles empty objects', () => {
    expect(redactSensitiveData({})).toEqual({});
  });

  it('handles empty arrays', () => {
    expect(redactSensitiveData([])).toEqual([]);
  });

  it('handles objects with only sensitive fields', () => {
    const input = { password: 'secret', token: 'tok' };
    const result = redactSensitiveData(input);
    expect(result).toEqual({ password: '[REDACTED]', token: '[REDACTED]' });
  });

  it('redacts devOtp field', () => {
    const input = { devOtp: '123456' };
    const result = redactSensitiveData(input);
    expect(result['devOtp']).toBe('[REDACTED]');
  });

  it('redacts x-request-id (sensitive header)', () => {
    const input = { 'x-request-id': 'req-123' };
    const result = redactSensitiveData(input);
    expect(result['x-request-id']).toBe('[REDACTED]');
  });

  it('is case-insensitive for key matching', () => {
    const input = { PASSWORD: 'secret', Authorization: 'Bearer tok', TOKEN: 'tok' };
    const result = redactSensitiveData(input);
    expect(result['PASSWORD']).toBe('[REDACTED]');
    expect(result['Authorization']).toBe('[REDACTED]');
    expect(result['TOKEN']).toBe('[REDACTED]');
  });
});

describe('isSensitiveKeyPattern', () => {
  it('returns true for sensitive keys', () => {
    expect(isSensitiveKeyPattern('password')).toBe(true);
    expect(isSensitiveKeyPattern('token')).toBe(true);
    expect(isSensitiveKeyPattern('accessToken')).toBe(true);
    expect(isSensitiveKeyPattern('authorization')).toBe(true);
    expect(isSensitiveKeyPattern('cookie')).toBe(true);
    expect(isSensitiveKeyPattern('otp')).toBe(true);
    expect(isSensitiveKeyPattern('resetToken')).toBe(true);
    expect(isSensitiveKeyPattern('passwordHash')).toBe(true);
  });

  it('returns false for safe keys', () => {
    expect(isSensitiveKeyPattern('email')).toBe(false);
    expect(isSensitiveKeyPattern('name')).toBe(false);
    expect(isSensitiveKeyPattern('id')).toBe(false);
    expect(isSensitiveKeyPattern('roleId')).toBe(false);
    expect(isSensitiveKeyPattern('status')).toBe(false);
    expect(isSensitiveKeyPattern('path')).toBe(false);
    expect(isSensitiveKeyPattern('method')).toBe(false);
  });
});

describe('SENSITIVE_PATTERNS_LIST', () => {
  it('contains password patterns', () => {
    expect(SENSITIVE_PATTERNS_LIST).toContain('password');
    expect(SENSITIVE_PATTERNS_LIST).toContain('passwordHash');
  });

  it('contains token patterns', () => {
    expect(SENSITIVE_PATTERNS_LIST).toContain('token');
    expect(SENSITIVE_PATTERNS_LIST).toContain('accessToken');
    expect(SENSITIVE_PATTERNS_LIST).toContain('refreshToken');
  });

  it('contains auth patterns', () => {
    expect(SENSITIVE_PATTERNS_LIST).toContain('authorization');
    expect(SENSITIVE_PATTERNS_LIST).toContain('cookie');
  });
});