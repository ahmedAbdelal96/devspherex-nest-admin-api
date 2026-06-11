/**
 * Permissions Swagger Decorators
 *
 * Compact decorators for Permissions controller endpoints.
 * All responses follow the Phase 6 ApiSuccessResponse<T> / ApiErrorResponse contract.
 */

import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ApiStandardOkResponse } from '../../../common/swagger/api-standard-response.decorators';
import { ApiCommonErrorResponses } from '../../../common/swagger/api-error-response.decorators';
import { API_TAG_PERMISSIONS } from '../../../common/swagger/api-tags';

/**
 * GET /permissions — List all permissions
 *
 * Protected — requires permissions.read permission.
 */
export function ApiListPermissionsDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_PERMISSIONS),
    ApiOperation({ summary: 'List all permissions', description: 'Returns a flat list of all available permissions. Requires permissions.read permission.' }),
    ApiStandardOkResponse('Permissions retrieved successfully', undefined, 200),
    ApiCommonErrorResponses(),
  );
}

/**
 * GET /permissions/grouped — List permissions grouped by category
 *
 * Protected — requires permissions.read permission.
 */
export function ApiListGroupedPermissionsDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_PERMISSIONS),
    ApiOperation({ summary: 'List permissions grouped by category', description: 'Returns all permissions organized by category/group. Requires permissions.read permission.' }),
    ApiStandardOkResponse('Grouped permissions retrieved successfully', undefined, 200),
    ApiCommonErrorResponses(),
  );
}

/**
 * GET /permissions/:id — Get a permission by ID
 *
 * Protected — requires permissions.read permission.
 */
export function ApiGetPermissionDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_PERMISSIONS),
    ApiOperation({ summary: 'Get a permission by ID', description: 'Returns a single permission by ID. Requires permissions.read permission.' }),
    ApiStandardOkResponse('Permission retrieved successfully', undefined, 200),
    ApiCommonErrorResponses(),
  );
}