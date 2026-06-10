/**
 * Audit Log Sanitizer Service
 *
 * Recursively redacts sensitive keys from objects before they are stored
 * in audit log records (before/after snapshots, metadata).
 *
 * Rules:
 * - Case-insensitive matching of sensitive keys
 * - Handles nested objects, arrays, and null
 * - Does NOT mutate the original object
 * - Limits recursion depth to prevent stack overflow
 * - Returns primitives/arrays unchanged
 *
 * Sensitive keys (always redacted):
 * password, currentPassword, newPassword, oldPassword, passwordConfirm,
 * passwordHash, accessToken, refreshToken, token, tokenHash, rawToken,
 * jti, secret, otp, otpHash, resetToken, resetTokenHash, resetSessionToken,
 * pepper, authorization, cookie, setCookie, apiKey, privateKey, clientSecret
 */

const REDACTED_PLACEHOLDER = '<redacted>';

/**
 * Lowercase set of sensitive field names.
 * Covers all common variations (password, passwordHash, etc.)
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'oldpassword',
  'passwordconfirm',
  'passwordhash',
  'accesstoken',
  'refreshtoken',
  'token',
  'tokenhash',
  'rawtoken',
  'jti',
  'secret',
  'otp',
  'otphash',
  'resettoken',
  'resettokenhash',
  'resetsessiontoken',
  'pepper',
  'authorization',
  'cookie',
  'setcookie',
  'apikey',
  'privatekey',
  'clientsecret',
]);

const MAX_DEPTH = 20;

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase());
}

/**
 * Recursively sanitize a value, redacting sensitive keys.
 * Returns a new object — original is never mutated.
 */
function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) {
    return '[exceeds depth limit]';
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value;

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    const obj = value as Record<string, unknown>;
    for (const [key, val] of Object.entries(obj)) {
      if (isSensitiveKey(key)) {
        result[key] = REDACTED_PLACEHOLDER;
      } else {
        result[key] = sanitizeValue(val, depth + 1);
      }
    }
    return result;
  }

  // Fallback for unknown types — return as-is
  return value;
}

/**
 * Sanitize an object before storing in an audit log record.
 * Recursively redacts all sensitive keys and returns a new object.
 *
 * @param obj - The object to sanitize (before/after snapshot or metadata)
 * @returns A new sanitized object. Original is unchanged.
 */
export function sanitizeAuditData(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }
  return sanitizeValue(obj, 0);
}
