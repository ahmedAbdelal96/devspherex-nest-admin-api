import { Injectable, ForbiddenException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, IS_AUTHENTICATED_KEY, REQUIRED_PERMISSIONS_KEY, PERMISSION_MODE_KEY } from '../rbac.constants';
import type { PermissionMode } from '../rbac.types';
import type { SystemPermissionKey } from '../system-permissions';
import { EffectivePermissionsService } from '../services/effective-permissions.service';

@Injectable()
export class PermissionsGuard {
  constructor(
    private reflector: Reflector,
    private effectivePermissionsService: EffectivePermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('Access denied');
    }

    const isAuthenticated = this.reflector.getAllAndOverride<boolean>(IS_AUTHENTICATED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<SystemPermissionKey[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      if (isAuthenticated) {
        return true;
      }
      throw new ForbiddenException('Access denied: route requires explicit classification');
    }

    const mode = this.reflector.getAllAndOverride<PermissionMode>(PERMISSION_MODE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? 'all';

    const hasPermission = mode === 'all'
      ? await this.effectivePermissionsService.hasAllPermissions(user.id, requiredPermissions)
      : await this.effectivePermissionsService.hasAnyPermission(user.id, requiredPermissions);

    if (!hasPermission) {
      throw new ForbiddenException('Access denied: insufficient permissions');
    }

    return true;
  }
}