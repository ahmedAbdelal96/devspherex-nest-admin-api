/**
 * Unknown Error Formatter
 *
 * Handles non-Error thrown values and ensures all unknown errors
 * return a safe 500 response with no internal details.
 */

import { HttpStatus } from '@nestjs/common';
import { AppErrorCodes } from './app-error-codes';
import type { ApiErrorResponse } from './error-response.types';
import type { ApiErrorMeta } from './error-response.types';

const SAFE_MESSAGE = 'An unexpected error occurred. Please try again later.';

export function buildUnknownErrorResponse(meta: ApiErrorMeta): ApiErrorResponse {
  return {
    success: false,
    message: SAFE_MESSAGE,
    code: AppErrorCodes.INTERNAL_SERVER_ERROR,
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    errors: [],
    meta,
  };
}

export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return process.env['NODE_ENV'] === 'production' ? SAFE_MESSAGE : error.message;
  }
  if (typeof error === 'string') return error;
  return SAFE_MESSAGE;
}