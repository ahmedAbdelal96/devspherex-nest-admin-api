/**
 * Validation Error Formatter — Unit Tests
 */

import { formatValidationErrors } from './validation-error.formatter';

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
      code: 'VALIDATION_FIELD_INVALID',
    });
    expect(errors[1]).toEqual({
      field: 'email',
      message: 'email should not be empty',
      code: 'VALIDATION_FIELD_INVALID',
    });
  });

  it('sanitizes sensitive field names', () => {
    const errors = formatValidationErrors([
      { property: 'password', constraints: { minLength: 'password must be longer' } },
    ]);
    expect(errors[0]['field']).toBe('field');
    expect(errors[0]['message']).toBe('password must be longer');
  });

  it('sanitizes sensitive field names case-insensitively', () => {
    const errors = formatValidationErrors([
      { property: 'PASSWORD', constraints: { minLength: 'password must be longer' } },
      { property: 'NewPassword', constraints: { minLength: 'password must be longer' } },
    ]);
    expect(errors[0]['field']).toBe('field');
    expect(errors[1]['field']).toBe('field');
  });

  it('flattens nested validation errors', () => {
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
    expect(errors[0]['field']).toBe('street');
    expect(errors[1]['field']).toBe('city');
  });

  it('returns empty array for empty input', () => {
    expect(formatValidationErrors([])).toEqual([]);
  });

  it('sanitizes message with raw values', () => {
    const errors = formatValidationErrors([
      { property: 'email', constraints: { isEmail: 'email must be an email' } },
    ]);
    // No raw values in the message to strip
    expect(errors[0]['message']).toBe('email must be an email');
  });
});
