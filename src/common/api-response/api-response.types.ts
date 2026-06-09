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
 * Marker type for data that is already wrapped (prevents double-wrapping).
 */
export const WRAPPED_MARKER = '__api_response_wrapped__' as const;
export type WrappedMarker = typeof WRAPPED_MARKER;

export function isWrapped(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    WRAPPED_MARKER in value
  );
}