/**
 * Roles Swagger Decorators
 *
 * Compact decorators for Roles controller endpoints.
 * All responses follow the Phase 6 ApiSuccessResponse<T> / ApiErrorResponse contract.
 */

import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ApiStandardOkResponse, ApiStandardCreatedResponse, ApiStandardNoContentResponse } from '../../../common/swagger/api-standard-response.decorators';
import { ApiCommonErrorResponses } from '../../../common/swagger/api-error-response.decorators';
import { API_TAG_ROLES } from '../../../common/swagger/api-tags';

/**
 * POST /roles — Create a new role
 *
 * Protected — requires roles.create permission.
 */
export function ApiCreateRoleDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_ROLES),
    ApiOperation({ summary: 'Create a new role', description: 'Create a new role with optional permissions. Requires roles.create permission.' }),
    ApiStandardCreatedResponse('Role created successfully', undefined),
    ApiCommonErrorResponses(),
  );
}

/**
 * GET /roles — List all roles
 *
 * Protected — requires roles.read permission.
 */
export function ApiListRolesDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_ROLES),
    ApiOperation({ summary: 'List all roles', description: 'Returns a list of all roles. Requires roles.read permission.' }),
    ApiStandardOkResponse('Roles retrieved successfully', undefined, 200),
    ApiCommonErrorResponses(),
  );
}

/**
 * GET /roles/:id — Get a role by ID
 *
 * Protected — requires roles.read permission.
 */
export function ApiGetRoleDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_ROLES),
    ApiOperation({ summary: 'Get a role by ID', description: 'Returns a single role by ID. Requires roles.read permission.' }),
    ApiStandardOkResponse('Role retrieved successfully', undefined, 200),
    ApiCommonErrorResponses(),
  );
}

/**
 * PUT /roles/:id — Update a role
 *
 * Protected — requires roles.update permission.
 */
export function ApiUpdateRoleDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_ROLES),
    ApiOperation({ summary: 'Update a role', description: 'Update a role\'s name, slug, or description. Requires roles.update permission.' }),
    ApiStandardOkResponse('Role updated successfully', undefined, 200),
    ApiCommonErrorResponses(),
  );
}

/**
 * DELETE /roles/:id — Delete a role
 *
 * Protected — requires roles.delete permission.
 */
export function ApiDeleteRoleDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_ROLES),
    ApiOperation({ summary: 'Delete a role', description: 'Permanently delete a role. Requires roles.delete permission.' }),
    ApiStandardNoContentResponse('Role deleted successfully'),
    ApiCommonErrorResponses(),
  );
}

/**
 * PUT /roles/:id/permissions — Update role permissions
 *
 * Protected — requires roles.update permission.
 */
export function ApiUpdateRolePermissionsDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_ROLES),
    ApiOperation({ summary: 'Update role permissions', description: 'Set the permissions for a role. Requires roles.update permission.' }),
    ApiStandardOkResponse('Role permissions updated successfully', undefined, 200),
    ApiCommonErrorResponses(),
  );
}

/**
 * POST /roles/:id/duplicate — Duplicate a role
 *
 * Protected — requires roles.create permission.
 */
export function ApiDuplicateRoleDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_ROLES),
    ApiOperation({ summary: 'Duplicate a role', description: 'Create a copy of an existing role. Requires roles.create permission.' }),
    ApiStandardCreatedResponse('Role duplicated successfully', undefined),
    ApiCommonErrorResponses(),
  );
}