import { Module } from '@nestjs/common';
import { EffectivePermissionsService } from './services/effective-permissions.service';

/**
 * RBAC Module
 *
 * Provides:
 *   - EffectivePermissionsService
 *
 * Notes:
 *   - PrismaService is NOT redeclared here on purpose. It is provided by the
 *     global DatabaseModule (src/common/database/database.module.ts) and is
 *     therefore already injectable across the application. Declaring it again
 *     here would create a duplicate provider pattern and is unnecessary.
 *   - PermissionsGuard is intentionally NOT registered here. It is registered
 *     globally in AppModule via APP_GUARD alongside JwtAuthGuard so the two
 *     global guards share the correct ordering.
 */
@Module({
  providers: [EffectivePermissionsService],
  exports: [EffectivePermissionsService],
})
export class RbacModule {}
