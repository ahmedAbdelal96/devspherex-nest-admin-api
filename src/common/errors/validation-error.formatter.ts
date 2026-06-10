/**
 * Validation Error Formatter
 *
 * Formats class-validator validation errors into ApiFieldError[].
 * Never exposes raw target objects or sensitive field values (e.g. passwords).
 *
 * - Flattens nested errors using dot-paths (address.street)
 * - Sanitizes sensitive field names case-insensitively
 * - Strips raw values from messages
 * - Does not expose target or value
 */

import { AppErrorCodes } from './app-error-codes';
import type { ApiFieldError } from './error-response.types';

export interface ValidationErrorItem {
  property: string;
  constraints?: Record<string, string>;
  children?: ValidationErrorItem[];
}

/**
 * Sensitive field names (lowercase) that must never appear in client-visible error messages.
 * Covers nested paths like credentials.password → credentials.field.
 */
const SENSITIVE_FIELDS = new Set([
  // Direct auth fields
  'password',
  'passwordconfirm',
  'currentpassword',
  'newpassword',
  'oldpassword',
  'otp',
  'resettoken',
  'refreshtoken',
  'accesstoken',
  'token',
  // Hash variants
  'passwordhash',
  'tokenhash',
  'resettokenhash',
  'otphash',
  // Auth secrets
  'secret',
  'pepper',
  // Dev/testing
  'devotp',
  'resetcode',
]);

/**
 * Check if any path segment is sensitive (case-insensitive).
 * e.g. "credentials.password" → sensitive
 */
function isSensitivePath(path: string): boolean {
  return path.split('.').some((segment) => SENSITIVE_FIELDS.has(segment.toLowerCase()));
}

function sanitizePath(path: string): string {
  if (isSensitivePath(path)) {
    return 'field';
  }
  return path;
}

function sanitizeMessage(message: string): string {
  return message.replace(/["'][^"']+["']/g, '"<value>"');
}

export function formatValidationErrors(validationErrors: ValidationErrorItem[]): ApiFieldError[] {
  const errors: ApiFieldError[] = [];

  function walk(item: ValidationErrorItem, parentPath?: string): void {
    const fieldPath = parentPath ? `${parentPath}.${item.property}` : item.property;
    const safePath = sanitizePath(fieldPath);

    if (item.constraints) {
      for (const [constraintKey, message] of Object.entries(item.constraints)) {
        // isNotEmpty → REQUIRED, everything else → INVALID
        const isRequired =
          constraintKey.toLowerCase() === 'isnotempty' ||
          constraintKey.toLowerCase() === 'isdefined';
        const code = isRequired
          ? AppErrorCodes.VALIDATION_FIELD_REQUIRED
          : AppErrorCodes.VALIDATION_FIELD_INVALID;

        errors.push({
          field: safePath,
          message: sanitizeMessage(message),
          code,
        });
      }
    }
    if (item.children) {
      for (const child of item.children) {
        walk(child, fieldPath);
      }
    }
  }

  for (const error of validationErrors) {
    walk(error);
  }

  return errors;
}