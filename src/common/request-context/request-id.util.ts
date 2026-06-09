/**
 * Request ID Utility
 *
 * Generates or extracts a request ID for correlation.
 */

import { randomBytes } from 'crypto';

export const REQUEST_ID_HEADER = 'x-request-id';
export const REQUEST_ID_KEY = 'requestId';

/**
 * Generate a unique request ID (UUID v4-like format).
 */
export function generateRequestId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Extract or generate a request ID from request headers.
 */
export function getOrCreateRequestId(headers: Record<string, string | string[] | undefined>): string {
  const headerValue = headers[REQUEST_ID_HEADER];
  if (headerValue === undefined || headerValue === '') {
    return generateRequestId();
  }
  // Use first value if array
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  // Validate format — only accept safe chars, max 64 chars
  if (typeof value === 'string' && value.length > 0 && value.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(value)) {
    return value;
  }
  return generateRequestId();
}