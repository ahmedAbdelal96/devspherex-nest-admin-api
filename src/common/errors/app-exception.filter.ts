/**
 * Global Exception Filter
 *
 * Catches all exceptions and maps them to the standard ApiErrorResponse shape.
 * - HttpException derivatives: mapped by status code
 * - PrismaClientKnownRequestError: mapped via PrismaErrorMapper
 * - PrismaClientUnknownRequestError: mapped to DB_INVALID_QUERY
 * - PrismaClientInitializationError: mapped to DB_CONNECTION_ERROR
 * - Generic Error: mapped to 500 INTERNAL_SERVER_ERROR
 * - Unknown thrown values: handled safely, never expose internals
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AppErrorCodes } from './app-error-codes';
import type { ApiErrorResponse, ApiErrorMeta } from './error-response.types';
import { mapPrismaError, extractPrismaField } from './prisma-error.mapper';
import { formatValidationErrors } from './validation-error.formatter';
import { buildUnknownErrorResponse } from './unknown-error.formatter';

function getMeta(request: Request): ApiErrorMeta {
  return {
    requestId: (request as unknown as Record<string, unknown>)['requestId'] as string || 'unknown',
    timestamp: new Date().toISOString(),
    path: request.path,
    method: request.method,
  };
}

function buildErrorResponse(
  message: string,
  code: string,
  statusCode: number,
  request: Request,
  errors: ApiErrorResponse['errors'] = [],
): ApiErrorResponse {
  return {
    success: false,
    message,
    code: code as ApiErrorResponse['code'],
    statusCode,
    errors,
    meta: getMeta(request),
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Handle HttpException derivatives
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Validation pipe errors come as objects with 'errors' array
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;

        // class-validator ValidationPipe format
        if (Array.isArray(responseObj['errors'])) {
          const formattedErrors = formatValidationErrors(
            responseObj['errors'] as Parameters<typeof formatValidationErrors>[0],
          );
          response.status(status).json(
            buildErrorResponse(
              (responseObj['message'] as string) || 'Validation failed',
              AppErrorCodes.VALIDATION_FAILED,
              status,
              request,
              formattedErrors,
            ),
          );
          return;
        }

        // Standard NestJS HttpException object response
        const message = this.sanitizeMessage(
          Array.isArray(responseObj['message'])
            ? responseObj['message'].join(', ')
            : (responseObj['message'] as string) || 'Request could not be processed',
        );
        const code = this.mapStatusToCode(status, exception);
        response.status(status).json(
          buildErrorResponse(message, code, status, request),
        );
        return;
      }

      // String message
      const message = this.sanitizeMessage(exceptionResponse as string);
      const code = this.mapStatusToCode(status, exception);
      response.status(status).json(
        buildErrorResponse(message, code, status, request),
      );
      return;
    }

    // Handle PrismaClientKnownRequestError
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapping = mapPrismaError(exception.code, exception.meta as Record<string, unknown> | undefined);
      const field = extractPrismaField(exception.meta as Record<string, unknown> | undefined);
      const errors = field
        ? [{ field, message: mapping.message, code: mapping.code }]
        : [];
      response.status(mapping.statusCode).json(
        buildErrorResponse(mapping.message, mapping.code, mapping.statusCode, request, errors),
      );
      this.logger.warn(`Prisma error [${exception.code}]: ${exception.message}`);
      return;
    }

    // Handle PrismaClientValidationError
    if (exception instanceof Prisma.PrismaClientValidationError) {
      response.status(HttpStatus.BAD_REQUEST).json(
        buildErrorResponse(
          'Database query could not be processed',
          AppErrorCodes.DB_INVALID_QUERY,
          HttpStatus.BAD_REQUEST,
          request,
        ),
      );
      this.logger.warn(`Prisma validation error: ${exception.message}`);
      return;
    }

    // Handle PrismaClientInitializationError
    if (exception instanceof Prisma.PrismaClientInitializationError) {
      response.status(HttpStatus.SERVICE_UNAVAILABLE).json(
        buildErrorResponse(
          'Database connection could not be established',
          AppErrorCodes.DB_CONNECTION_ERROR,
          HttpStatus.SERVICE_UNAVAILABLE,
          request,
        ),
      );
      this.logger.error(`Prisma initialization error: ${exception.message}`);
      return;
    }

    // Handle generic Error
    if (exception instanceof Error) {
      const isProduction = process.env['NODE_ENV'] === 'production';
      const message = isProduction
        ? 'An unexpected error occurred. Please try again later.'
        : exception.message;

      this.logger.error(`Unhandled exception: ${exception.message}`, exception.stack);

      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
        buildErrorResponse(
          message,
          AppErrorCodes.INTERNAL_SERVER_ERROR,
          HttpStatus.INTERNAL_SERVER_ERROR,
          request,
        ),
      );
      return;
    }

    // Handle unknown thrown values (non-Error)
    this.logger.error(`Unknown thrown value: ${String(exception)}`);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      buildUnknownErrorResponse(getMeta(request)),
    );
  }

  private mapStatusToCode(status: number, _exception: HttpException): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return AppErrorCodes.BAD_REQUEST;
      case HttpStatus.UNAUTHORIZED:
        return AppErrorCodes.AUTH_UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return AppErrorCodes.AUTH_FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return AppErrorCodes.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return AppErrorCodes.CONFLICT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return AppErrorCodes.RATE_LIMITED;
      case HttpStatus.SERVICE_UNAVAILABLE:
        return AppErrorCodes.SERVICE_UNAVAILABLE;
      default:
        return AppErrorCodes.INTERNAL_SERVER_ERROR;
    }
  }

  private sanitizeMessage(message: string): string {
    if (!message) return 'Request could not be processed';
    // Strip any sensitive data patterns that might appear in error messages
    return message
      .replace(/(password|token|secret|otp|pepper)\s*[:=]\s*\S+/gi, '$1: <redacted>')
      .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, '<email>');
  }
}