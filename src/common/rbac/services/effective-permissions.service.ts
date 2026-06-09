import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SYSTEM_PERMISSION_KEY_SET } from '../system-permissions';
import type { SystemPermissionKey } from '../system-permissions';

@Injectable()
export class EffectivePermissionsService {
  constructor(private prisma: PrismaService) {}

  async getEffectivePermissionKeys(userId: string): Promise<SystemPermissionKey[]> {
    const perms = await this.getEffectivePermissionSet(userId);
    return Array.from(perms);
  }

  async getEffectivePermissionSet(userId: string): Promise<Set<SystemPermissionKey>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        permissionOverrides: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!user) {
      return new Set();
    }

    if (user.status !== 'ACTIVE') {
      return new Set();
    }

    const effectivePerms = new Set<SystemPermissionKey>();

    if (user.role && user.role.status === 'ACTIVE' && !user.role.deletedAt) {
      for (const rp of user.role.permissions) {
        const key = rp.permission.key as SystemPermissionKey;
        if (SYSTEM_PERMISSION_KEY_SET.has(key)) {
          effectivePerms.add(key);
        }
      }
    }

    const denyKeys = new Set<string>();
    const allowKeys = new Set<string>();

    for (const override of user.permissionOverrides) {
      const key = override.permission.key;
      if (!SYSTEM_PERMISSION_KEY_SET.has(key as SystemPermissionKey)) {
        continue;
      }
      if (override.effect === 'DENY') {
        denyKeys.add(key);
      } else if (override.effect === 'ALLOW') {
        allowKeys.add(key);
      }
    }

    for (const key of denyKeys) {
      effectivePerms.delete(key as SystemPermissionKey);
    }

    for (const key of allowKeys) {
      effectivePerms.add(key as SystemPermissionKey);
    }

    return effectivePerms;
  }

  async hasAllPermissions(userId: string, required: SystemPermissionKey[]): Promise<boolean> {
    const effectivePerms = await this.getEffectivePermissionSet(userId);
    for (const perm of required) {
      if (!effectivePerms.has(perm)) {
        return false;
      }
    }
    return true;
  }

  async hasAnyPermission(userId: string, required: SystemPermissionKey[]): Promise<boolean> {
    const effectivePerms = await this.getEffectivePermissionSet(userId);
    for (const perm of required) {
      if (effectivePerms.has(perm)) {
        return true;
      }
    }
    return false;
  }
}