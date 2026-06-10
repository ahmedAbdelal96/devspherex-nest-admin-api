/**
 * Standard API Success Response Shape
 *
 * All successful HTTP responses are wrapped in this shape by ApiResponseInterceptor.
 */

export interface ApiSuccessMeta {
  requestId: string;
  timestamp: string;
  path: string;
  method: string;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data: T | null;
  meta: ApiSuccessMeta;
}

/**
 * Non-enumerable Symbol marker to prevent double-wrapping.
 * Using Symbol.for ensures the marker is globally accessible but never
 * appears in JSON.stringify() output (non-enumerable).
 */
const WRAPPED_SYMBOL = Symbol.for('devspherex.apiResponseWrapped');

export const WRAPPED_MARKER = '__api_response_wrapped__' as const;
export type WrappedMarker = typeof WRAPPED_MARKER;

/**
 * Mark a response object so downstream interceptors skip re-wrapping.
 * The marker is non-enumerable — it never appears in JSON output.
 */
export function markWrapped(obj: object): void {
  Object.defineProperty(obj, WRAPPED_SYMBOL, {
    value: true,
    enumerable: false,
    configurable: false,
  });
}

export function isWrapped(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  return Reflect.has(value, WRAPPED_SYMBOL);
}