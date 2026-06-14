/**
 * Audit Logs Swagger Decorators
 *
 * Compact decorators for AuditLogs controller endpoints.
 * All responses follow the Phase 6 ApiSuccessResponse<T> / ApiErrorResponse contract.
 */

import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ApiStandardOkResponse, ApiStandardCreatedResponse, ApiStandardPaginatedResponse } from '../../../common/swagger/api-standard-response.decorators';
import { ApiCommonErrorResponses } from '../../../common/swagger/api-error-response.decorators';
import { API_TAG_AUDIT_LOGS } from '../../../common/swagger/api-tags';

/**
 * GET /audit-logs — List audit logs
 *
 * Protected — requires audit-logs.read permission.
 * Supports filtering by actor, action, resource, status, and date range.
 */
export function ApiListAuditLogsDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_AUDIT_LOGS),
    ApiOperation({
      summary: 'List audit logs',
      description: 'Returns a paginated list of audit log entries. Supports filtering by actor, action, resource type/ID, status, and date range. Requires audit-logs.read permission.',
    }),
    ApiStandardPaginatedResponse('Audit logs retrieved successfully', undefined),
    ApiCommonErrorResponses(),
  );
}

/**
 * GET /audit-logs/:id — Get a single audit log entry
 *
 * Protected — requires audit-logs.read permission.
 */
export function ApiGetAuditLogDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_AUDIT_LOGS),
    ApiOperation({
      summary: 'Get an audit log entry',
      description: 'Returns a single audit log entry by ID. Requires audit-logs.read permission.',
    }),
    ApiStandardOkResponse('Audit log entry retrieved successfully', undefined, 200),
    ApiCommonErrorResponses(),
  );
}

/**
 * POST /audit-logs — Create an audit log entry
 *
 * Protected — requires audit-logs.create permission.
 * For programmatic audit log creation (internal use).
 */
export function ApiCreateAuditLogDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_AUDIT_LOGS),
    ApiOperation({
      summary: 'Create an audit log entry',
      description: 'Programmatically create an audit log entry. Requires audit-logs.create permission.',
    }),
    ApiStandardCreatedResponse('Audit log entry created successfully', undefined),
    ApiCommonErrorResponses(),
  );
}