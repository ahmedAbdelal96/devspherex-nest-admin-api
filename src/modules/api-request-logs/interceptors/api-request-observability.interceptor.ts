/**
 * API Request Observability Interceptor
 *
 * Logs every API request after completion:
 * - durationMs, statusCode, outcome
 * - requestId, method, path, route
 * - userId, userEmail, userRoleId (if authenticated)
 * - ipAddress, userAgent
 * - errorCode (from req.observability set by GlobalExceptionFilter)
 *
 * Non-blocking: logging failures never break API requests.
 * Skips health/static paths.
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ApiRequestLogService } from '../services/api-request-log.service';
import { SKIPPED_PATTERNS } from '../constants/api-request-log.constants';
import { AppErrorCodes } from '../../../common/errors/app-error-codes';
import { HttpStatus } from '@nestjs/common';

function shouldSkipLog(path: string): boolean {
  return SKIPPED_PATTERNS.some((pattern) => path.startsWith(pattern));
}

function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded !== undefined) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    if (typeof first === 'string') {
      return first.split(',')[0].trim() || undefined;
    }
  }
  return req.ip as string | undefined;
}

function getUserAgent(req: Request): string | undefined {
  const ua = req.headers['user-agent'];
  return Array.isArray(ua) ? ua[0] : (ua as string | undefined);
}

interface RequestObservability {
  errorCode?: string;
  errorMessage?: string;
}

@Injectable()
export class ApiRequestObservabilityInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ApiRequestObservabilityInterceptor.name);

  constructor(private readonly apiRequestLogService: ApiRequestLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const path = request.originalUrl || request.url;
    if (shouldSkipLog(path)) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - startTime;
        const statusCode = response.statusCode;
        const outcome = statusCode < 400 ? 'SUCCESS' : 'FAILURE';

        this.logRequest(request, path, statusCode, durationMs, outcome);
      }),
      catchError((err: unknown) => {
        const durationMs = Date.now() - startTime;
        const statusCode =
          typeof err === 'object' && err !== null && 'getStatus' in err
            ? (err as { getStatus: () => number }).getStatus()
            : 500;

        // Read errorCode/errorMessage from req.observability (set by GlobalExceptionFilter
        // for HttpException errors). For generic Errors without getStatus, derive from
        // the status code since the filter always maps 500 -> INTERNAL_SERVER_ERROR.
        const observability = (request as unknown as { observability?: RequestObservability })['observability'];
        const errorCode =
          observability?.errorCode ??
          (err as { code?: string })['code'] ??
          this.statusToErrorCode(statusCode);
        const errorMessage =
          observability?.errorMessage ?? (err as { message?: string })['message'];

        const outcome = 'FAILURE';

        this.logRequest(request, path, statusCode, durationMs, outcome, errorCode, errorMessage);

        throw err;
      }),
    );
  }

  private logRequest(
    req: Request,
    path: string,
    statusCode: number,
    durationMs: number,
    outcome: 'SUCCESS' | 'FAILURE',
    errorCode?: string,
    errorMessage?: string,
  ): void {
    const requestId = (req as unknown as { requestId?: string })['requestId'];
    const method = req.method;
    const route = req.route?.path;

    const user = (req as unknown as { user?: { id?: string; email?: string; roleId?: string } })['user'];
    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);

    // Fall back to req.observability for success path (no error thrown)
    const observability = (req as unknown as { observability?: RequestObservability })['observability'];
    const finalErrorCode = errorCode ?? observability?.errorCode;
    const finalErrorMessage = errorMessage ?? observability?.errorMessage;

    this.apiRequestLogService.log({
      requestId,
      method,
      path,
      route,
      statusCode,
      durationMs,
      outcome,
      user: user
        ? { id: user.id, email: user.email, roleId: user.roleId }
        : undefined,
      ipAddress,
      userAgent,
      errorCode: finalErrorCode,
      errorMessage: finalErrorMessage,
    });
  }

  private statusToErrorCode(status: number): string {
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
}