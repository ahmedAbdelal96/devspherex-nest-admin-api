/**
 * Permissions Seed Module
 *
 * Seeds system permissions from the central source of truth (SYSTEM_PERMISSIONS).
 * Uses upsert by permission key — safe to run multiple times.
 * Reset mode deletes only known system permission keys.
 */

import { PrismaClient } from '@prisma/client';
import {
  SYSTEM_PERMISSION_KEYS,
  SYSTEM_PERMISSIONS,
  SYSTEM_PERMISSION_KEY_SET,
} from '../../../src/common/rbac/system-permissions';
import type { SeedContext, SeedStats } from '../seed.types';

type PermissionKey = string;

export async function seedPermissions(ctx: SeedContext): Promise<SeedStats> {
  const prisma = ctx.prisma as PrismaClient;
  const { logger } = ctx;
  let created = 0;
  let updated = 0;
  let skipped = 0;

  logger.info(`Seeding ${SYSTEM_PERMISSIONS.length} system permissions`);

  for (const perm of SYSTEM_PERMISSIONS) {
    const existing = await prisma.permission.findUnique({ where: { key: perm.key } });

    if (!existing) {
      await prisma.permission.create({
        data: {
          key: perm.key,
          resource: perm.resource,
          action: perm.action,
          label: perm.label,
          description: perm.description ?? null,
          group: perm.group,
          isSystem: perm.isSystem,
        },
      });
      created++;
    } else {
      await prisma.permission.update({
        where: { key: perm.key },
        data: {
          resource: perm.resource,
          action: perm.action,
          label: perm.label,
          description: perm.description ?? null,
          group: perm.group,
          isSystem: perm.isSystem,
        },
      });
      updated++;
    }
  }

  logger.info(`Permissions seed complete: created=${created}, updated=${updated}, skipped=${skipped}`);
  return { created, updated, skipped, deleted: 0 };
}

export async function resetPermissions(ctx: SeedContext): Promise<SeedStats> {
  const prisma = ctx.prisma as PrismaClient;
  const { logger } = ctx;
  let deleted = 0;

  const keysToDelete: PermissionKey[] = Array.from(SYSTEM_PERMISSION_KEY_SET);

  if (keysToDelete.length === 0) {
    logger.warn('No system permission keys found to delete');
    return { created: 0, updated: 0, skipped: 0, deleted: 0 };
  }

  logger.warn(`Deleting ${keysToDelete.length} system permissions`);

  // Delete in batches to avoid very long IN clauses
  const batchSize = 50;
  for (let i = 0; i < keysToDelete.length; i += batchSize) {
    const batch = keysToDelete.slice(i, i + batchSize);
    const result = await prisma.permission.deleteMany({
      where: { key: { in: batch }, isSystem: true },
    });
    deleted += result.count;
  }

  logger.info(`Permissions reset complete: deleted=${deleted}`);
  return { created: 0, updated: 0, skipped: 0, deleted };
}