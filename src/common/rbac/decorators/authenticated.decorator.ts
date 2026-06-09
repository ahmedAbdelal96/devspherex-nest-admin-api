import { SetMetadata } from '@nestjs/common';
import { IS_AUTHENTICATED_KEY } from '../rbac.constants';

/**
 * Marks a route as requiring authentication but no RBAC permissions.
 *
 * Use on self-service endpoints like /auth/me, /auth/logout, /auth/logout-all
 * Route requires valid JWT but does not require specific RBAC permissions.
 *
 * Usage:
 * @Authenticated()
 * @Get('me')
 */
export const Authenticated = () => SetMetadata(IS_AUTHENTICATED_KEY, true);