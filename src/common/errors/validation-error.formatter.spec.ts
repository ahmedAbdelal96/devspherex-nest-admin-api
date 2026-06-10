/**
 * Validation Error Formatter — Unit Tests
 */

import { formatValidationErrors } from './validation-error.formatter';
import { AppErrorCodes } from './app-error-codes';

describe('formatValidationErrors', () => {
  it('formats basic field errors', () => {
    const errors = formatValidationErrors([
      {
        property: 'email',
        constraints: {
          isEmail: 'email must be an email',
          isNotEmpty: 'email should not be empty',
        },
      },
    ]);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toEqual({
      field: 'email',
      message: 'email must be an email',
      code: AppErrorCodes.VALIDATION_FIELD_INVALID,
    });
    expect(errors[1]).toEqual({
      field: 'email',
      message: 'email should not be empty',
      code: AppErrorCodes.VALIDATION_FIELD_REQUIRED,
    });
  });

  it('sanitizes sensitive field names case-insensitively', () => {
    const errors = formatValidationErrors([
      { property: 'password', constraints: { minLength: 'password must be longer' } },
      { property: 'PASSWORD', constraints: { minLength: 'password must be longer' } },
      { property: 'NewPassword', constraints: { minLength: 'password must be longer' } },
    ]);
    expect(errors[0]['field']).toBe('field');
    expect(errors[1]['field']).toBe('field');
    expect(errors[2]['field']).toBe('field');
  });

  it('sanitizes nested sensitive paths — credentials.password', () => {
    const errors = formatValidationErrors([
      {
        property: 'credentials',
        children: [
          { property: 'password', constraints: { minLength: 'password must be longer' } },
        ],
      },
    ]);
    expect(errors[0]['field']).toBe('field');
  });

  it('sanitizes nested sensitive paths — auth.refreshToken', () => {
    const errors = formatValidationErrors([
      {
        property: 'auth',
        children: [
          { property: 'refreshToken', constraints: { isNotEmpty: 'refresh token required' } },
        ],
      },
    ]);
    expect(errors[0]['field']).toBe('field');
  });

  it('flattens nested validation errors with dot-paths', () => {
    const errors = formatValidationErrors([
      {
        property: 'address',
        children: [
          { property: 'street', constraints: { isNotEmpty: 'street is required' } },
          { property: 'city', constraints: { isNotEmpty: 'city is required' } },
        ],
      },
    ]);
    expect(errors).toHaveLength(2);
    expect(errors[0]['field']).toBe('address.street');
    expect(errors[1]['field']).toBe('address.city');
  });

  it('marks isNotEmpty constraints as VALIDATION_FIELD_REQUIRED', () => {
    const errors = formatValidationErrors([
      { property: 'email', constraints: { isNotEmpty: 'email should not be empty' } },
      { property: 'name', constraints: { isNotEmpty: 'name must not be empty' } },
    ]);
    expect(errors[0]['code']).toBe(AppErrorCodes.VALIDATION_FIELD_REQUIRED);
    expect(errors[1]['code']).toBe(AppErrorCodes.VALIDATION_FIELD_REQUIRED);
  });

  it('marks other constraint types as VALIDATION_FIELD_INVALID', () => {
    const errors = formatValidationErrors([
      { property: 'email', constraints: { isEmail: 'email must be an email' } },
      { property: 'age', constraints: { min: 'age must be a positive integer' } },
    ]);
    expect(errors[0]['code']).toBe(AppErrorCodes.VALIDATION_FIELD_INVALID);
    expect(errors[1]['code']).toBe(AppErrorCodes.VALIDATION_FIELD_INVALID);
  });

  it('returns empty array for empty input', () => {
    expect(formatValidationErrors([])).toEqual([]);
  });

  it('does not expose target in field path', () => {
    const errors = formatValidationErrors([
      { property: 'profile', constraints: {}, children: [
        { property: 'firstName', constraints: { isNotEmpty: 'first name is required' } },
      ] },
    ]);
    expect(errors[0]['field']).toBe('profile.firstName');
    expect(errors[0]['field']).not.toContain('target');
  });
});