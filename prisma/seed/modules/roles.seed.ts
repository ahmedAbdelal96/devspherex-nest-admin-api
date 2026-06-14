/**
 * Roles Seed Module
 *
 * Seeds default roles: super-admin, admin, viewer.
 * Uses upsert by slug — safe to run multiple times.
 * Reset mode deletes only known seed role slugs.
 */

import { PrismaClient } from '@prisma/client';
import {
  SYSTEM_PERMISSION_KEYS,
  SYSTEM_PERMISSION_KEY_SET,
} from '../../../src/common/rbac/system-permissions';
import type { SeedContext, SeedStats } from '../seed.types';

const SEED_ROLE_SLUGS = ['super-admin', 'admin', 'viewer'] as const;
type SeedRoleSlug = typeof SEED_ROLE_SLUGS[number];

const ROLES_TO_SEED: Array<{
  name: string;
  slug: SeedRoleSlug;
  description: string;
  permissionKeys: string[];
}> = [
  {
    name: 'Super Admin',
    slug: 'super-admin',
    description: 'Full system access with all permissions',
    permissionKeys: Array.from(SYSTEM_PERMISSION_KEY_SET),
  },
  {
    name: 'Admin',
    slug: 'admin',
    description: 'Administrative access — manages users, roles, permissions, and audit logs',
    permissionKeys: [
      // Auth
      SYSTEM_PERMISSION_KEYS.AUTH.ME_READ,
      SYSTEM_PERMISSION_KEYS.AUTH.PASSWORD_CHANGE,
      // Users — full management
      SYSTEM_PERMISSION_KEYS.USERS.READ,
      SYSTEM_PERMISSION_KEYS.USERS.CREATE,
      SYSTEM_PERMISSION_KEYS.USERS.UPDATE,
      SYSTEM_PERMISSION_KEYS.USERS.DELETE,
      SYSTEM_PERMISSION_KEYS.USERS.STATUS_UPDATE,
      SYSTEM_PERMISSION_KEYS.USERS.ROLE_UPDATE,
      SYSTEM_PERMISSION_KEYS.USERS.PERMISSIONS_READ,
      SYSTEM_PERMISSION_KEYS.USERS.PERMISSIONS_OVERRIDE,
      // Roles — full management
      SYSTEM_PERMISSION_KEYS.ROLES.READ,
      SYSTEM_PERMISSION_KEYS.ROLES.CREATE,
      SYSTEM_PERMISSION_KEYS.ROLES.UPDATE,
      SYSTEM_PERMISSION_KEYS.ROLES.DELETE,
      SYSTEM_PERMISSION_KEYS.ROLES.PERMISSIONS_UPDATE,
      SYSTEM_PERMISSION_KEYS.ROLES.DUPLICATE,
      // Permissions — read only
      SYSTEM_PERMISSION_KEYS.PERMISSIONS.READ,
      SYSTEM_PERMISSION_KEYS.PERMISSIONS.GROUPED_READ,
      // Audit Logs
      SYSTEM_PERMISSION_KEYS.AUDIT_LOGS.READ,
      SYSTEM_PERMISSION_KEYS.AUDIT_LOGS.CREATE,
      // API Request Logs
      SYSTEM_PERMISSION_KEYS.API_REQUEST_LOGS.READ,
      // System
      SYSTEM_PERMISSION_KEYS.SYSTEM.HEALTH_READ,
      SYSTEM_PERMISSION_KEYS.SETTINGS.READ,
      SYSTEM_PERMISSION_KEYS.SETTINGS.UPDATE,
    ],
  },
  {
    name: 'Viewer',
    slug: 'viewer',
    description: 'Read-only access to system resources',
    permissionKeys: [
      // Auth
      SYSTEM_PERMISSION_KEYS.AUTH.ME_READ,
      // Read permissions
      SYSTEM_PERMISSION_KEYS.USERS.READ,
      SYSTEM_PERMISSION_KEYS.ROLES.READ,
      SYSTEM_PERMISSION_KEYS.PERMISSIONS.READ,
      SYSTEM_PERMISSION_KEYS.PERMISSIONS.GROUPED_READ,
      SYSTEM_PERMISSION_KEYS.AUDIT_LOGS.READ,
      SYSTEM_PERMISSION_KEYS.API_REQUEST_LOGS.READ,
      SYSTEM_PERMISSION_KEYS.SYSTEM.HEALTH_READ,
      SYSTEM_PERMISSION_KEYS.SETTINGS.READ,
    ],
  },
];

export async function seedRoles(ctx: SeedContext): Promise<SeedStats> {
  const prisma = ctx.prisma as PrismaClient;
  const { logger } = ctx;
  let created = 0;
  let updated = 0;
  let skipped = 0;

  logger.info(`Seeding ${ROLES_TO_SEED.length} default roles`);

  for (const roleDef of ROLES_TO_SEED) {
    const existing = await prisma.role.findUnique({ where: { slug: roleDef.slug } });

    let roleId: string;

    if (!existing) {
      const role = await prisma.role.create({
        data: {
          name: roleDef.name,
          slug: roleDef.slug,
          description: roleDef.description,
          status: 'ACTIVE',
          isSystem: true,
        },
      });
      roleId = role.id;
      created++;
    } else {
      const role = await prisma.role.update({
        where: { slug: roleDef.slug },
        data: {
          name: roleDef.name,
          description: roleDef.description,
          status: 'ACTIVE',
          isSystem: true,
        },
      });
      roleId = role.id;
      updated++;
    }

    // Connect permissions — first clear existing, then upsert
    await prisma.rolePermission.deleteMany({ where: { roleId } });

    for (const permKey of roleDef.permissionKeys) {
      const perm = await prisma.permission.findUnique({ where: { key: permKey } });
      if (!perm) {
        logger.warn(`Permission not found: ${permKey} — skipping`);
        continue;
      }

      const existingRp = await prisma.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId, permissionId: perm.id } },
      });

      if (!existingRp) {
        await prisma.rolePermission.create({
          data: { roleId, permissionId: perm.id },
        });
      }
    }
  }

  logger.info(`Roles seed complete: created=${created}, updated=${updated}, skipped=${skipped}`);
  return { created, updated, skipped, deleted: 0 };
}

export async function resetRoles(ctx: SeedContext): Promise<SeedStats> {
  const prisma = ctx.prisma as PrismaClient;
  const { logger } = ctx;

  let deleted = 0;

  for (const slug of SEED_ROLE_SLUGS) {
    const result = await prisma.role.deleteMany({ where: { slug } });
    deleted += result.count;
  }

  logger.info(`Roles reset complete: deleted=${deleted}`);
  return { created: 0, updated: 0, skipped: 0, deleted };
}