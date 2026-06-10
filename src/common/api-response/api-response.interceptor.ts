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
  markWrapped,
} from './api-response.types';
import { buildSuccessResponse, buildEmptyResponse } from './api-response.factory';

/**
 * Known auth/service operation field names.
 * These may coexist with `message` and still be considered part of an envelope.
 */
const KNOWN_ENVELOPE_KEYS = new Set([
  'message',
  'data',
  'accessToken',
  'refreshToken',
  'user',
  'devOtp',
  'resetSessionToken',
  'expiresIn',
  'token',
]);

/**
 * Detect whether a value is a controller message-envelope (not a domain object).
 *
 * Allowed shapes:
 * A. { message }
 * B. { message, data }
 * C. { message, accessToken, refreshToken }
 * D. { message, accessToken, refreshToken, user }
 * E. { message, devOtp }
 * F. { message, resetSessionToken, expiresIn }
 *
 * NOT an envelope: { message, id, body, ...other domain fields }
 */
function isControllerMessageEnvelope(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Must have a string message
  if (!('message' in obj) || typeof obj['message'] !== 'string') {
    return false;
  }

  // Extract non-message keys
  const nonMessageKeys = Object.keys(obj).filter((k) => k !== 'message');

  // Case A: only { message }
  if (nonMessageKeys.length === 0) {
    return true;
  }

  // All remaining keys must be known envelope keys
  const allKnown = nonMessageKeys.every((k) => KNOWN_ENVELOPE_KEYS.has(k));
  return allKnown;
}

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

        // Extract message from controller message-envelopes (auth responses)
        if (isControllerMessageEnvelope(data)) {
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
          // Mark as wrapped (non-enumerable Symbol — never appears in JSON)
          markWrapped(response);
          return response;
        }

        return buildSuccessResponse(data, request);
      }),
    );
  }
}