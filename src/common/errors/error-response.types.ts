/**
 * Standard API Error Response Shape
 *
 * All error responses are returned in this shape by GlobalExceptionFilter.
 */

import type { AppErrorCode } from './app-error-codes';

export interface ApiErrorMeta {
  requestId: string;
  timestamp: string;
  path: string;
  method: string;
}

export interface ApiFieldError {
  field: string;
  message: string;
  code: AppErrorCode;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  code: AppErrorCode;
  statusCode: number;
  errors: ApiFieldError[];
  meta: ApiErrorMeta;
}