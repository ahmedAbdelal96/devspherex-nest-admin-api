/**
 * Users Swagger Decorators
 *
 * Compact decorators for Users controller endpoints.
 * All responses follow the Phase 6 ApiSuccessResponse<T> / ApiErrorResponse contract.
 */

import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ApiStandardOkResponse, ApiStandardCreatedResponse, ApiStandardNoContentResponse, ApiStandardPaginatedResponse } from '../../../common/swagger/api-standard-response.decorators';
import { ApiCommonErrorResponses } from '../../../common/swagger/api-error-response.decorators';
import { API_TAG_USERS } from '../../../common/swagger/api-tags';

/**
 * POST /users — Create a new user
 *
 * Protected — requires users.create permission.
 */
export function ApiCreateUserDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_USERS),
    ApiOperation({ summary: 'Create a new user', description: 'Create a new user account. Requires users.create permission.' }),
    ApiStandardCreatedResponse('User created successfully', undefined),
    ApiCommonErrorResponses(),
  );
}

/**
 * GET /users — List all users
 *
 * Protected — requires users.read permission.
 * Supports pagination and filtering.
 */
export function ApiListUsersDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_USERS),
    ApiOperation({ summary: 'List all users', description: 'Returns a paginated list of users. Requires users.read permission.' }),
    ApiStandardPaginatedResponse('Users retrieved successfully', undefined),
    ApiCommonErrorResponses(),
  );
}

/**
 * GET /users/:id — Get a user by ID
 *
 * Protected — requires users.read permission.
 */
export function ApiGetUserDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_USERS),
    ApiOperation({ summary: 'Get a user by ID', description: 'Returns a single user by ID. Requires users.read permission.' }),
    ApiStandardOkResponse('User retrieved successfully', undefined, 200),
    ApiCommonErrorResponses(),
  );
}

/**
 * PUT /users/:id — Update a user
 *
 * Protected — requires users.update permission.
 */
export function ApiUpdateUserDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_USERS),
    ApiOperation({ summary: 'Update a user', description: 'Update a user\'s profile. Requires users.update permission.' }),
    ApiStandardOkResponse('User updated successfully', undefined, 200),
    ApiCommonErrorResponses(),
  );
}

/**
 * DELETE /users/:id — Delete a user
 *
 * Protected — requires users.delete permission.
 */
export function ApiDeleteUserDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_USERS),
    ApiOperation({ summary: 'Delete a user', description: 'Permanently delete a user account. Requires users.delete permission.' }),
    ApiStandardNoContentResponse('User deleted successfully'),
    ApiCommonErrorResponses(),
  );
}

/**
 * PUT /users/:id/status — Update user status
 *
 * Protected — requires users.update permission.
 */
export function ApiUpdateUserStatusDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_USERS),
    ApiOperation({ summary: 'Update user status', description: 'Activate or deactivate a user account. Requires users.update permission.' }),
    ApiStandardOkResponse('User status updated successfully', undefined, 200),
    ApiCommonErrorResponses(),
  );
}

/**
 * PUT /users/:id/role — Update user role
 *
 * Protected — requires users.update permission.
 */
export function ApiUpdateUserRoleDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_USERS),
    ApiOperation({ summary: 'Update user role', description: 'Change a user\'s role assignment. Requires users.update permission.' }),
    ApiStandardOkResponse('User role updated successfully', undefined, 200),
    ApiCommonErrorResponses(),
  );
}

/**
 * GET /users/:id/effective-permissions — Get effective permissions
 *
 * Protected — requires users.read permission.
 * Returns computed permissions (role + overrides).
 */
export function ApiGetEffectivePermissionsDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_USERS),
    ApiOperation({ summary: 'Get effective permissions', description: 'Returns the computed effective permissions for a user (role + overrides). Requires users.read permission.' }),
    ApiStandardOkResponse('Effective permissions retrieved', undefined, 200),
    ApiCommonErrorResponses(),
  );
}

/**
 * PUT /users/:id/permission-overrides — Update permission overrides
 *
 * Protected — requires users.update permission.
 * Sets permission overrides for a user.
 */
export function ApiUpdatePermissionOverridesDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_USERS),
    ApiOperation({ summary: 'Update permission overrides', description: 'Set or clear permission overrides for a user. Requires users.update permission.' }),
    ApiStandardOkResponse('Permission overrides updated', undefined, 200),
    ApiCommonErrorResponses(),
  );
}