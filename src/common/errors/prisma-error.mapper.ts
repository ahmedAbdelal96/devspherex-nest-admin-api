/**
 * Prisma Error Mapper
 *
 * Maps PrismaClientKnownRequestError codes to HTTP status codes and AppErrorCodes.
 * Never leaks Prisma internals or SQL details to clients.
 */

import { HttpStatus } from '@nestjs/common';
import { AppErrorCodes } from './app-error-codes';
import type { AppErrorCode } from './app-error-codes';
import type { ApiFieldError } from './error-response.types';

export interface PrismaErrorMapping {
  statusCode: HttpStatus;
  code: AppErrorCode;
  message: string;
  errors?: ApiFieldError[];
}

// Prisma error codes: https://www.prisma.io/docs/orm/reference/error-reference
const PRISMA_CODE_MAP: Record<string, PrismaErrorMapping> = {
  // Unique constraint violation
  P2002: {
    statusCode: HttpStatus.CONFLICT,
    code: AppErrorCodes.DB_UNIQUE_CONSTRAINT,
    message: 'A record with this value already exists',
  },
  // Record not found
  P2025: {
    statusCode: HttpStatus.NOT_FOUND,
    code: AppErrorCodes.DB_RECORD_NOT_FOUND,
    message: 'The requested record was not found',
  },
  // Foreign key constraint violation
  P2003: {
    statusCode: HttpStatus.CONFLICT,
    code: AppErrorCodes.DB_FOREIGN_KEY_CONSTRAINT,
    message: 'Operation failed due to invalid relation',
  },
  // Null constraint violation
  P2001: {
    statusCode: HttpStatus.BAD_REQUEST,
    code: AppErrorCodes.DB_INVALID_QUERY,
    message: 'A required field is missing',
  },
  // Value too long
  P2006: {
    statusCode: HttpStatus.BAD_REQUEST,
    code: AppErrorCodes.DB_INVALID_QUERY,
    message: 'A field value exceeds the allowed length',
  },
  // Type mismatch
  P2007: {
    statusCode: HttpStatus.BAD_REQUEST,
    code: AppErrorCodes.DB_INVALID_QUERY,
    message: 'Data type mismatch',
  },
  // Connection errors
  P1001: {
    statusCode: HttpStatus.SERVICE_UNAVAILABLE,
    code: AppErrorCodes.DB_CONNECTION_ERROR,
    message: 'Database connection could not be established',
  },
  P1002: {
    statusCode: HttpStatus.SERVICE_UNAVAILABLE,
    code: AppErrorCodes.DB_CONNECTION_ERROR,
    message: 'Database server not reachable',
  },
  P1003: {
    statusCode: HttpStatus.SERVICE_UNAVAILABLE,
    code: AppErrorCodes.DB_CONNECTION_ERROR,
    message: 'Database does not exist',
  },
  P1010: {
    statusCode: HttpStatus.SERVICE_UNAVAILABLE,
    code: AppErrorCodes.DB_CONNECTION_ERROR,
    message: 'Database connection access denied',
  },
  P1011: {
    statusCode: HttpStatus.SERVICE_UNAVAILABLE,
    code: AppErrorCodes.DB_CONNECTION_ERROR,
    message: 'Database connection error',
  },
};

export function mapPrismaError(code: string, _meta?: Record<string, unknown>): PrismaErrorMapping {
  const mapped = PRISMA_CODE_MAP[code];
  if (mapped) return { ...mapped };
  return {
    statusCode: HttpStatus.BAD_REQUEST,
    code: AppErrorCodes.DB_INVALID_QUERY,
    message: 'Database operation could not be completed',
  };
}

export function extractPrismaField(meta?: Record<string, unknown>): string | null {
  if (!meta) return null;
  if (Array.isArray(meta['field'])) return String(meta['field'][0]);
  if (typeof meta['field'] === 'string') return meta['field'] as string;
  if (Array.isArray(meta['target'])) return String(meta['target'][0]);
  return null;
}