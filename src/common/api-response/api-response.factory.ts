/**
 * ApiResponse Factory
 *
 * Creates standardized success response objects.
 * Used by ApiResponseInterceptor.
 */

import { Request } from 'express';
import type { ApiSuccessResponse } from './api-response.types';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export interface ResponseMeta {
  requestId: string;
  timestamp: string;
  path: string;
  method: string;
}

function getMetaFromRequest(request: Request): ResponseMeta {
  return {
    requestId: (request as unknown as Record<string, unknown>)['requestId'] as string || 'unknown',
    timestamp: new Date().toISOString(),
    path: request.path,
    method: request.method as HttpMethod,
  };
}

/**
 * Derive a meaningful default message from HTTP method and route.
 */
export function deriveMessage(method: string, path: string): string {
  const normalizedPath = path.replace(/\/[^/]+$/, ''); // strip trailing segment
  const segments = normalizedPath.split('/').filter(Boolean);
  const resource = segments[segments.length - 1] ?? 'Record';

  switch (method.toUpperCase()) {
    case 'GET':
      return path.includes('/') && !path.match(/\/[a-f0-9-]+$/i)
        ? 'Records retrieved successfully'
        : 'Record retrieved successfully';
    case 'POST':
      return `${resource.slice(0, 1).toUpperCase() + resource.slice(1)} created successfully`;
    case 'PUT':
    case 'PATCH':
      return `${resource.slice(0, 1).toUpperCase() + resource.slice(1)} updated successfully`;
    case 'DELETE':
      return `${resource.slice(0, 1).toUpperCase() + resource.slice(1)} deleted successfully`;
    default:
      return 'Operation completed successfully';
  }
}

export function buildSuccessResponse<T>(
  data: T,
  request: Request,
  overrideMessage?: string,
): ApiSuccessResponse<T> {
  return {
    success: true,
    message: overrideMessage ?? deriveMessage(request.method, request.path),
    data: data as T | null,
    meta: getMetaFromRequest(request),
  };
}

export function buildEmptyResponse(
  request: Request,
  message = 'Operation completed successfully',
): ApiSuccessResponse<null> {
  return {
    success: true,
    message,
    data: null,
    meta: getMetaFromRequest(request),
  };
}