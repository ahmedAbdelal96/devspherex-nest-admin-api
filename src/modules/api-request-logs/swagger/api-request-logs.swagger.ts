/**
 * API Request Logs Swagger Decorators
 *
 * Compact decorators for ApiRequestLogs controller endpoints.
 * All responses follow the Phase 6 ApiSuccessResponse<T> / ApiErrorResponse contract.
 */

import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ApiStandardOkResponse, ApiStandardPaginatedResponse } from '../../../common/swagger/api-standard-response.decorators';
import { ApiCommonErrorResponses } from '../../../common/swagger/api-error-response.decorators';
import { API_TAG_API_REQUEST_LOGS } from '../../../common/swagger/api-tags';

/**
 * GET /api-request-logs — List API request logs
 *
 * Protected — requires api-request-logs.read permission.
 * Supports filtering by requestId, method, path, route, statusCode, outcome,
 * actorId, errorCode, date range, and duration range.
 */
export function ApiListApiRequestLogsDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_API_REQUEST_LOGS),
    ApiOperation({
      summary: 'List API request logs',
      description: 'Returns a paginated list of API request log entries for observability and debugging. Supports filtering by requestId, method, path, route, statusCode, outcome, actor, errorCode, date range, and duration. Requires api-request-logs.read permission.',
    }),
    ApiStandardPaginatedResponse('API request logs retrieved successfully', undefined),
    ApiCommonErrorResponses(),
  );
}

/**
 * GET /api-request-logs/:id — Get a single API request log entry
 *
 * Protected — requires api-request-logs.read permission.
 */
export function ApiGetApiRequestLogDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_API_REQUEST_LOGS),
    ApiOperation({
      summary: 'Get an API request log entry',
      description: 'Returns a single API request log entry by ID. Requires api-request-logs.read permission.',
    }),
    ApiStandardOkResponse('API request log entry retrieved successfully', undefined, 200),
    ApiCommonErrorResponses(),
  );
}