/**
 * Error Response Decorators
 *
 * Provides reusable @ApiResponse decorators for standard error shapes.
 * Documents the Phase 6 ApiErrorResponse contract.
 */

import { applyDecorators } from '@nestjs/common';
import {
  ApiResponseOptions,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
  ApiTooManyRequestsResponse,
  ApiInternalServerErrorResponse as SwaggerApiInternalServerErrorResponse,
} from '@nestjs/swagger';

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false, enum: [false] },
    message: { type: 'string', example: 'Validation failed' },
    code: { type: 'string', example: 'VALIDATION_FAILED' },
    statusCode: { type: 'integer', example: 400 },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string', example: 'email' },
          message: { type: 'string', example: 'Invalid email format' },
          code: { type: 'string', example: 'VALIDATION_FIELD_INVALID' },
        },
      },
    },
    meta: {
      type: 'object',
      properties: {
        requestId: { type: 'string', example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6' },
        timestamp: { type: 'string', format: 'date-time', example: '2026-06-10T12:00:00.000Z' },
        path: { type: 'string', example: '/users' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
      },
      required: ['requestId', 'timestamp', 'path', 'method'],
    },
  },
  required: ['success', 'message', 'code', 'statusCode', 'errors', 'meta'],
};

/**
 * 400 Bad Request — validation failed
 */
export function ApiValidationErrorResponse(
  description = 'Request validation failed — see errors array for field-level details',
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiBadRequestResponse({
      status: 400,
      description,
      schema: ERROR_RESPONSE_SCHEMA,
    } as ApiResponseOptions),
  );
}

/**
 * 401 Unauthorized — invalid or missing credentials
 */
export function ApiUnauthorizedErrorResponse(
  description = 'Authentication required — provide a valid Bearer token',
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiUnauthorizedResponse({
      status: 401,
      description,
      schema: {
        ...ERROR_RESPONSE_SCHEMA,
        properties: {
          ...ERROR_RESPONSE_SCHEMA.properties,
          code: { type: 'string', example: 'AUTH_UNAUTHORIZED' },
          message: { type: 'string', example: 'Invalid or expired access token' },
        },
      },
    } as ApiResponseOptions),
  );
}

/**
 * 403 Forbidden — authenticated but insufficient permissions
 */
export function ApiForbiddenErrorResponse(
  description = 'Access denied — your role does not have the required permission',
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiForbiddenResponse({
      status: 403,
      description,
      schema: {
        ...ERROR_RESPONSE_SCHEMA,
        properties: {
          ...ERROR_RESPONSE_SCHEMA.properties,
          code: { type: 'string', example: 'AUTH_FORBIDDEN' },
          message: { type: 'string', example: 'You do not have permission to perform this action' },
        },
      },
    } as ApiResponseOptions),
  );
}

/**
 * 404 Not Found — resource does not exist
 */
export function ApiNotFoundErrorResponse(
  description = 'Resource not found — the requested resource does not exist or has been removed',
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiNotFoundResponse({
      status: 404,
      description,
      schema: {
        ...ERROR_RESPONSE_SCHEMA,
        properties: {
          ...ERROR_RESPONSE_SCHEMA.properties,
          code: { type: 'string', example: 'NOT_FOUND' },
          message: { type: 'string', example: 'Resource not found' },
        },
      },
    } as ApiResponseOptions),
  );
}

/**
 * 409 Conflict — resource state conflict (e.g., email already in use)
 */
export function ApiConflictErrorResponse(
  description = 'Resource conflict — the request conflicts with the current state of the resource',
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiConflictResponse({
      status: 409,
      description,
      schema: {
        ...ERROR_RESPONSE_SCHEMA,
        properties: {
          ...ERROR_RESPONSE_SCHEMA.properties,
          code: { type: 'string', example: 'CONFLICT' },
          message: { type: 'string', example: 'Resource already exists' },
        },
      },
    } as ApiResponseOptions),
  );
}

/**
 * 429 Too Many Requests — rate limit exceeded
 */
export function ApiRateLimitErrorResponse(
  description = 'Rate limit exceeded — too many requests. Slow down and try again later.',
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiTooManyRequestsResponse({
      status: 429,
      description,
      schema: {
        ...ERROR_RESPONSE_SCHEMA,
        properties: {
          ...ERROR_RESPONSE_SCHEMA.properties,
          code: { type: 'string', example: 'RATE_LIMITED' },
          message: { type: 'string', example: 'Too many requests — please slow down' },
        },
      },
    } as ApiResponseOptions),
  );
}

/**
 * 500 Internal Server Error — unexpected server error
 */
export function ApiInternalServerErrorResponse(
  description = 'Internal server error — an unexpected error occurred. Try again later.',
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    SwaggerApiInternalServerErrorResponse({
      status: 500,
      description,
      schema: {
        ...ERROR_RESPONSE_SCHEMA,
        properties: {
          ...ERROR_RESPONSE_SCHEMA.properties,
          code: { type: 'string', example: 'INTERNAL_SERVER_ERROR' },
          message: { type: 'string', example: 'An unexpected error occurred' },
        },
      },
    } as ApiResponseOptions),
  );
}

/**
 * Aggregates all common error responses for a typical endpoint.
 * Use on every protected endpoint that can fail with multiple error types.
 */
export function ApiCommonErrorResponses(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiValidationErrorResponse(),
    ApiUnauthorizedErrorResponse(),
    ApiForbiddenErrorResponse(),
    ApiNotFoundErrorResponse(),
    ApiConflictErrorResponse(),
    ApiRateLimitErrorResponse(),
    ApiInternalServerErrorResponse(),
  );
}