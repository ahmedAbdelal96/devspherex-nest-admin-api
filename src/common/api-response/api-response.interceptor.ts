/**
 * ApiResponse Interceptor
 *
 * Wraps all successful HTTP responses in the standard ApiSuccessResponse shape.
 * - Skips already-wrapped responses (prevents double-wrapping).
 * - Handles null, arrays, and objects uniformly.
 * - Extracts message from { message: string } controller returns.
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import {
  ApiSuccessResponse,
  isWrapped,
  WRAPPED_MARKER,
} from './api-response.types';
import { buildSuccessResponse, buildEmptyResponse } from './api-response.factory';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      map((data: unknown) => {
        // Prevent double-wrapping
        if (isWrapped(data)) return data;

        // Handle void/null responses (e.g. @HttpCode(204) or delete endpoints)
        if (data === null || data === undefined) {
          return buildEmptyResponse(request);
        }

        // Extract message from { message: string } returns (auth controllers)
        if (
          typeof data === 'object' &&
          !Array.isArray(data) &&
          data !== null &&
          'message' in data &&
          typeof (data as Record<string, unknown>).message === 'string' &&
          Object.keys(data).length <= 3
        ) {
          const { message, ...rest } = data as Record<string, unknown>;
          const payload = Object.keys(rest).length > 0 ? rest : null;
          const response: ApiSuccessResponse<unknown> = {
            success: true,
            message: message as string,
            data: payload as ApiSuccessResponse['data'],
            meta: {
              requestId: (request as unknown as Record<string, unknown>)['requestId'] as string || 'unknown',
              timestamp: new Date().toISOString(),
              path: request.path,
              method: request.method,
            },
          };
          // Mark as wrapped so downstream interceptors don't re-wrap
          (response as unknown as Record<string, unknown>)[WRAPPED_MARKER] = true;
          return response;
        }

        return buildSuccessResponse(data, request);
      }),
    );
  }
}