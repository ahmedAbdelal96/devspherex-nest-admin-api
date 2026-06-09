/**
 * Validation Error Formatter
 *
 * Formats class-validator validation errors into ApiFieldError[].
 * Never exposes raw target objects or sensitive field values (e.g. passwords).
 */

import { AppErrorCodes } from './app-error-codes';
import type { ApiFieldError } from './error-response.types';

export interface ValidationErrorItem {
  property: string;
  constraints?: Record<string, string>;
  children?: ValidationErrorItem[];
}

/**
 * Sensitive field names that must never appear in validation error messages.
 */
const SENSITIVE_FIELDS = new Set([
  'password',
  'passwordconfirm',
  'currentpassword',
  'newpassword',
  'oldpassword',
  'otp',
  'resettoken',
  'refreshtoken',
  'accesstoken',
]);

function sanitizeFieldName(field: string): string {
  return SENSITIVE_FIELDS.has(field.toLowerCase()) ? 'field' : field;
}

function sanitizeMessage(message: string): string {
  return message.replace(/["'][^"']+["']/g, '"<value>"');
}

export function formatValidationErrors(validationErrors: ValidationErrorItem[]): ApiFieldError[] {
  const errors: ApiFieldError[] = [];

  function walk(item: ValidationErrorItem) {
    const field = sanitizeFieldName(item.property);
    if (item.constraints) {
      for (const [, message] of Object.entries(item.constraints)) {
        errors.push({
          field,
          message: sanitizeMessage(message),
          code: AppErrorCodes.VALIDATION_FIELD_INVALID,
        });
      }
    }
    if (item.children) {
      for (const child of item.children) {
        walk(child);
      }
    }
  }

  for (const error of validationErrors) {
    walk(error);
  }

  return errors;
}