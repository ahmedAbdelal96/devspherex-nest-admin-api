import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { SystemPermissionKey } from '../system-permissions';
import { SYSTEM_PERMISSION_KEY_SET } from '../system-permissions';

/**
 * Effective Permissions Service
 *
 * Computes the final set of permission keys for a user, combining:
 *   1. Role permissions (granted by the user's role)
 *   2. User ALLOW overrides (explicitly granted per user)
 *   3. User DENY overrides (explicitly revoked per user)
 *
 * DENY precedence rule:
 *   DENY is applied LAST, so DENY always wins — even if the same key
 *   appears in role grants and in ALLOW overrides.
 *
 *   Order of operations:
 *     a. Add role permission keys (if role is ACTIVE and not soft-deleted).
 *     b. Add ALLOW override keys (if key is in SYSTEM_PERMISSION_KEY_SET).
 *     c. Apply DENY override keys LAST (if key is in SYSTEM_PERMISSION_KEY_SET).
 *
 * Edge cases:
 *   - User not found              → empty set
 *   - User status !== 'ACTIVE'    → empty set
 *   - User has no role            → only overrides apply
 *   - Role disabled or soft-deleted → role permissions are ignored
 *   - Unknown DB keys (not in SYSTEM_PERMISSION_KEY_SET) → silently ignored
 *
 * No super-admin bypass exists. No hardcoded role-name checks.
 */
@Injectable()
export class EffectivePermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the effective permission keys as an array.
   */
  async getEffectivePermissionKeys(userId: string): Promise<SystemPermissionKey[]> {
    const set = await this.getEffectivePermissionSet(userId);
    return Array.from(set);
  }

  /**
   * Returns the effective permission keys as a Set for fast O(1) lookup.
   */
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

    const effective = new Set<SystemPermissionKey>();

    // 1. User not found → empty set.
    if (!user) {
      return effective;
    }

    // 2. Disabled / pending users have no effective permissions.
    if (user.status !== 'ACTIVE') {
      return effective;
    }

    // 3. Role grants — only if role is ACTIVE and not soft-deleted.
    const roleIsUsable =
      user.role !== null &&
      user.role.status === 'ACTIVE' &&
      user.role.deletedAt === null;

    if (roleIsUsable && user.role) {
      for (const rolePermission of user.role.permissions) {
        const key = rolePermission.permission.key as SystemPermissionKey;
        if (SYSTEM_PERMISSION_KEY_SET.has(key)) {
          effective.add(key);
        }
      }
    }

    // 4. Collect override keys (skip unknown / stale DB keys).
    const allowOverrideKeys = new Set<SystemPermissionKey>();
    const denyOverrideKeys = new Set<SystemPermissionKey>();

    for (const override of user.permissionOverrides) {
      const key = override.permission.key as SystemPermissionKey;
      if (!SYSTEM_PERMISSION_KEY_SET.has(key)) {
        continue;
      }
      if (override.effect === 'ALLOW') {
        allowOverrideKeys.add(key);
      } else if (override.effect === 'DENY') {
        denyOverrideKeys.add(key);
      }
    }

    // 5. Apply ALLOW overrides (additive).
    for (const key of allowOverrideKeys) {
      effective.add(key);
    }

    // 6. Apply DENY overrides LAST — DENY always wins.
    for (const key of denyOverrideKeys) {
      effective.delete(key);
    }

    return effective;
  }

  /**
   * Returns true only if the user has EVERY required key.
   */
  async hasAllPermissions(
    userId: string,
    required: SystemPermissionKey[],
  ): Promise<boolean> {
    const effective = await this.getEffectivePermissionSet(userId);
    for (const key of required) {
      if (!effective.has(key)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Returns true if the user has AT LEAST ONE of the required keys.
   */
  async hasAnyPermission(
    userId: string,
    required: SystemPermissionKey[],
  ): Promise<boolean> {
    const effective = await this.getEffectivePermissionSet(userId);
    for (const key of required) {
      if (effective.has(key)) {
        return true;
      }
    }
    return false;
  }
}
