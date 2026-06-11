/**
 * Standard API Response Decorators
 *
 * Provides reusable @ApiResponse decorators for standard response shapes.
 * Each decorator documents the Phase 6 ApiSuccessResponse<T> wrapper.
 */

import { applyDecorators } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiResponseOptions,
} from '@nestjs/swagger';

/**
 * Standard 200 OK response with ApiSuccessResponse<T> wrapper.
 * Use for single-resource GET, PUT, PATCH operations.
 */
export function ApiStandardOkResponse<T>(
  description: string,
  responseType?: { new (): T },
  status = 200,
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiOkResponse({
      status,
      description,
      schema: buildStandardResponseSchema(responseType, description, status),
    } as ApiResponseOptions),
  );
}

/**
 * Standard 201 Created response with ApiSuccessResponse<T> wrapper.
 * Use for POST operations that create a resource.
 */
export function ApiStandardCreatedResponse<T>(
  description: string,
  responseType?: { new (): T },
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiCreatedResponse({
      status: 201,
      description,
      schema: buildStandardResponseSchema(responseType, description, 201),
    } as ApiResponseOptions),
  );
}

/**
 * Standard 204 No Content response.
 * Use for DELETE operations or actions with no return body.
 */
export function ApiStandardNoContentResponse(
  description = 'Operation completed successfully',
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiNoContentResponse({ description }),
  );
}

/**
 * Paginated response with meta for list endpoints.
 * Use for GET list operations that return arrays with pagination.
 */
export function ApiStandardPaginatedResponse<T>(
  description: string,
  itemSchema: { new (): T },
  options?: { pageParam?: string; limitParam?: string; totalParam?: string },
): MethodDecorator & ClassDecorator {
  const pageParam = options?.pageParam ?? 'page';
  const limitParam = options?.limitParam ?? 'limit';
  const totalParam = options?.totalParam ?? 'total';

  return applyDecorators(
    ApiOkResponse({
      status: 200,
      description,
      schema: buildPaginatedResponseSchema(itemSchema, description, pageParam, limitParam, totalParam),
    } as ApiResponseOptions),
  );
}

/**
 * Message-only response for actions that return no data payload.
 */
export function ApiStandardMessageResponse(
  description: string,
  message: string,
  status = 200,
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiOkResponse({
      status,
      description,
      schema: buildMessageResponseSchema(message, description, status),
    } as ApiResponseOptions),
  );
}

// ─── Internal schema builders ────────────────────────────────────────────────

function buildStandardResponseSchema<T>(
  responseType: { new (): T } | undefined,
  description: string,
  _status: number,
): Record<string, unknown> {
  const dataSchema = responseType
    ? { $ref: `#/components/schemas/${responseType.name}` }
    : { type: 'object', description: 'Response data payload' };

  return {
    type: 'object',
    description,
    properties: {
      success: { type: 'boolean', example: true, enum: [true] },
      message: { type: 'string', example: 'Operation completed successfully' },
      data: dataSchema,
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
    required: ['success', 'message', 'data', 'meta'],
  };
}

function buildPaginatedResponseSchema<T>(
  itemSchema: { new (): T },
  description: string,
  pageParam: string,
  limitParam: string,
  totalParam: string,
): Record<string, unknown> {
  return {
    type: 'object',
    description,
    properties: {
      success: { type: 'boolean', example: true, enum: [true] },
      message: { type: 'string', example: 'Operation completed successfully' },
      data: {
        type: 'array',
        items: { $ref: `#/components/schemas/${itemSchema.name}` },
      },
      meta: {
        type: 'object',
        properties: {
          requestId: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          path: { type: 'string' },
          method: { type: 'string' },
          pagination: {
            type: 'object',
            properties: {
              [pageParam]: { type: 'integer', example: 1 },
              [limitParam]: { type: 'integer', example: 20 },
              [totalParam]: { type: 'integer', example: 100 },
              totalPages: { type: 'integer', example: 5 },
            },
            required: [pageParam, limitParam, totalParam, 'totalPages'],
          },
        },
        required: ['requestId', 'timestamp', 'path', 'method', 'pagination'],
      },
    },
    required: ['success', 'message', 'data', 'meta'],
  };
}

function buildMessageResponseSchema(
  message: string,
  description: string,
  _status: number,
): Record<string, unknown> {
  return {
    type: 'object',
    description,
    properties: {
      success: { type: 'boolean', example: true, enum: [true] },
      message: { type: 'string', example: message },
      data: { type: 'null', description: 'No data payload for this response' },
      meta: {
        type: 'object',
        properties: {
          requestId: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          path: { type: 'string' },
          method: { type: 'string' },
        },
        required: ['requestId', 'timestamp', 'path', 'method'],
      },
    },
    required: ['success', 'message', 'data', 'meta'],
  };
}