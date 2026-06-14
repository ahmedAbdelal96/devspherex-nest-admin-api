import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './common/database/database.module';
import { RbacModule } from './common/rbac/rbac.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/rbac/guards/permissions.guard';
import { LoggingModule } from './common/logging';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { ApiRequestLogsModule } from './modules/api-request-logs/api-request-logs.module';

@Module({
  imports: [
    // Config
    AppConfigModule,
    ConfigModule,
    // Logging
    LoggingModule,
    // Database
    DatabaseModule,
    // RBAC
    RbacModule,
    // Business Modules
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    AuditLogsModule,
    ApiRequestLogsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}