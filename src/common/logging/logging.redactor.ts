/**
 * Logging Redactor
 *
 * Deeply redacts sensitive keys from objects before they are logged.
 * Does not mutate the original object.
 * Handles nested objects, arrays, circular references, null, and undefined.
 */

const SENSITIVE_KEY_PATTERNS = [
  'password',
  'passwordHash',
  'passwordhash',
  'currentPassword',
  'newPassword',
  'oldPassword',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'resetToken',
  'reset_token',
  'authorization',
  'Authorization',
  'cookie',
  'Cookie',
  'cookies',
  'secret',
  'apiKey',
  'api_key',
  'otp',
  'otpCode',
  'hash',
  'credential',
  'credentials',
  'session',
  'sessions',
  'jwt',
  'bearer',
  'passport',
  'resetSessionToken',
  'devOtp',
  'passwordRecoveryToken',
  'x-request-id',
  'x-api-key',
];

const REDACTED = '[REDACTED]';

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some(
    (pattern) =>
      lower === pattern ||
      lower.startsWith(pattern.toLowerCase() + ' ') ||
      lower.startsWith(pattern.toLowerCase() + '.') ||
      lower.startsWith(pattern.toLowerCase() + '_') ||
      lower.includes(pattern.toLowerCase()),
  );
}

/**
 * Recursively redact sensitive fields from a value.
 * Does not mutate the original.
 */
function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen));
  }

  if (typeof value === 'object') {
    // Handle circular references
    if (seen.has(value as object)) {
      return '[Circular]';
    }
    const newObj: Record<string, unknown> = {};
    seen.add(value as object);
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(k)) {
        newObj[k] = REDACTED;
      } else {
        newObj[k] = redactValue(v, seen);
      }
    }
    return newObj;
  }

  // function, symbol, etc. — leave as-is stringified
  return String(value);
}

/**
 * Redact sensitive fields from an object.
 * Returns a new object — does not mutate the input.
 * Safe to call with null/undefined/primitives (returns them as-is).
 */
export function redactSensitiveData<T>(data: T): T {
  return redactValue(data, new WeakSet()) as T;
}

/**
 * Check if a key matches any sensitive pattern.
 * Useful for testing.
 */
export function isSensitiveKeyPattern(key: string): boolean {
  return isSensitiveKey(key);
}

/**
 * List of all sensitive key patterns.
 * Useful for testing.
 */
export const SENSITIVE_PATTERNS_LIST = [...SENSITIVE_KEY_PATTERNS];