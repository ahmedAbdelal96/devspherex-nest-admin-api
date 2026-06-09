import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../rbac.constants';

/**
 * Marks a route as public - no authentication required.
 *
 * Use on endpoints like /auth/login, /auth/register, /auth/refresh
 * Public routes skip JWT guard and permissions guard entirely.
 *
 * Usage:
 * @Public()
 * @Post('login')
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);