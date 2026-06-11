/**
 * Auth Swagger Decorators
 *
 * Compact decorators for Auth controller endpoints.
 * All responses follow the Phase 6 ApiSuccessResponse<T> / ApiErrorResponse contract.
 *
 * Security:
 * - Public endpoints: no auth required
 * - Protected endpoints: require Bearer token
 */

import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ApiStandardOkResponse, ApiStandardCreatedResponse, ApiStandardNoContentResponse } from '../../../common/swagger/api-standard-response.decorators';
import { ApiCommonErrorResponses } from '../../../common/swagger/api-error-response.decorators';
import { API_TAG_AUTH } from '../../../common/swagger/api-tags';

/**
 * POST /auth/register — Register a new user account
 *
 * Public — no authentication required.
 * Returns the created user (without password hash).
 */
export function ApiRegisterDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_AUTH),
    ApiOperation({ summary: 'Register a new user account', description: 'Create a new user account. No authentication required.' }),
    ApiStandardCreatedResponse('User account created successfully', undefined),
    ApiCommonErrorResponses(),
  );
}

/**
 * POST /auth/login — Authenticate and receive tokens
 *
 * Public — no authentication required.
 * Returns accessToken, refreshToken, and user info.
 */
export function ApiLoginDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_AUTH),
    ApiOperation({ summary: 'Authenticate user', description: 'Login with email and password to receive access and refresh tokens.' }),
    ApiStandardOkResponse('Login successful — tokens issued', undefined, 200),
    ApiCommonErrorResponses(),
  );
}

/**
 * POST /auth/logout — Invalidate current session
 *
 * Protected — requires Bearer token.
 * Invalidates the current refresh token.
 */
export function ApiLogoutDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_AUTH),
    ApiOperation({ summary: 'Logout current session', description: 'Invalidate the current refresh token. Requires authentication.' }),
    ApiStandardNoContentResponse('Session terminated successfully'),
    ApiCommonErrorResponses(),
  );
}

/**
 * POST /auth/logout-all — Invalidate all sessions
 *
 * Protected — requires Bearer token.
 * Invalidates all refresh tokens for the user.
 */
export function ApiLogoutAllDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_AUTH),
    ApiOperation({ summary: 'Logout all sessions', description: 'Invalidate all refresh tokens for this user. Requires authentication.' }),
    ApiStandardOkResponse('All sessions terminated', undefined, 200),
    ApiCommonErrorResponses(),
  );
}

/**
 * POST /auth/refresh — Refresh access token
 *
 * Public — no authentication required.
 * Accepts refreshToken in body, returns new accessToken.
 */
export function ApiRefreshDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_AUTH),
    ApiOperation({ summary: 'Refresh access token', description: 'Exchange a valid refresh token for a new access token.' }),
    ApiStandardOkResponse('Token refreshed successfully', undefined, 200),
    ApiCommonErrorResponses(),
  );
}

/**
 * GET /auth/me — Get current user profile
 *
 * Protected — requires Bearer token.
 * Returns the authenticated user's profile.
 */
export function ApiMeDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_AUTH),
    ApiOperation({ summary: 'Get current user profile', description: 'Returns the authenticated user\'s profile. Requires authentication.' }),
    ApiStandardOkResponse('Current user profile retrieved', undefined, 200),
    ApiCommonErrorResponses(),
  );
}

/**
 * POST /auth/change-password — Change password
 *
 * Protected — requires Bearer token.
 * Requires currentPassword and newPassword.
 */
export function ApiChangePasswordDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_AUTH),
    ApiOperation({ summary: 'Change password', description: 'Change the authenticated user\'s password. Requires current and new password.' }),
    ApiStandardOkResponse('Password changed successfully', undefined, 200),
    ApiCommonErrorResponses(),
  );
}

/**
 * POST /auth/forgot-password — Request password recovery
 *
 * Public — no authentication required.
 * Triggers password recovery flow (OTP or email link).
 */
export function ApiForgotPasswordDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_AUTH),
    ApiOperation({ summary: 'Request password recovery', description: 'Initiate the password recovery flow. No authentication required.' }),
    ApiStandardOkResponse('Password recovery initiated — check your email', undefined, 200),
    ApiCommonErrorResponses(),
  );
}

/**
 * POST /auth/verify-password-recovery-otp — Verify OTP
 *
 * Public — no authentication required.
 * Verify OTP sent to user's email/phone.
 */
export function ApiVerifyPasswordRecoveryOtpDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_AUTH),
    ApiOperation({ summary: 'Verify password recovery OTP', description: 'Verify the one-time password sent during password recovery. No authentication required.' }),
    ApiStandardOkResponse('OTP verified — proceed to reset password', undefined, 200),
    ApiCommonErrorResponses(),
  );
}

/**
 * POST /auth/reset-password — Reset password with token
 *
 * Public — no authentication required.
 * Reset password using the session token from verify step.
 */
export function ApiResetPasswordDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags(API_TAG_AUTH),
    ApiOperation({ summary: 'Reset password', description: 'Reset the user\'s password using the session token from the verification step. No authentication required.' }),
    ApiStandardOkResponse('Password reset successfully — you can now login', undefined, 200),
    ApiCommonErrorResponses(),
  );
}