/**
 * Users Seed Module
 *
 * Seeds a default admin user for development/template setup.
 * Uses upsert by email — safe to run multiple times.
 * Reset mode deletes only known seed user emails.
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import type { SeedContext, SeedStats } from '../seed.types';

const SALT_ROUNDS = 12;
const SEED_ADMIN_EMAIL = 'admin@example.com';
const SEED_ADMIN_NAME = 'Admin';
const SEED_ADMIN_ROLE_SLUG = 'super-admin';
const DEV_FALLBACK_PASSWORD = 'Admin@123456';

export async function seedUsers(ctx: SeedContext): Promise<SeedStats> {
  const prisma = ctx.prisma as PrismaClient;
  const { logger, mode } = ctx;

  const password = resolveAdminPassword();
  logger.info(`Admin user email: ${SEED_ADMIN_EMAIL}`);

  // Hash password without logging it
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Find super-admin role by slug
  const role = await prisma.role.findUnique({ where: { slug: SEED_ADMIN_ROLE_SLUG } });
  if (!role) {
    logger.error(`Role '${SEED_ADMIN_ROLE_SLUG}' not found — cannot seed admin user`);
    throw new Error(`Seed error: role '${SEED_ADMIN_ROLE_SLUG}' does not exist. Run roles seed first.`);
  }

  const existing = await prisma.user.findUnique({ where: { email: SEED_ADMIN_EMAIL } });

  if (!existing) {
    await prisma.user.create({
      data: {
        name: SEED_ADMIN_NAME,
        email: SEED_ADMIN_EMAIL,
        passwordHash,
        status: 'ACTIVE',
        roleId: role.id,
        tokenVersion: 1,
      },
    });
    logger.success(`Admin user created: ${SEED_ADMIN_EMAIL}`);
  } else {
    await prisma.user.update({
      where: { email: SEED_ADMIN_EMAIL },
      data: {
        name: SEED_ADMIN_NAME,
        passwordHash,
        status: 'ACTIVE',
        roleId: role.id,
        tokenVersion: existing.tokenVersion,
      },
    });
    logger.success(`Admin user updated: ${SEED_ADMIN_EMAIL}`);
  }

  return { created: existing ? 0 : 1, updated: existing ? 1 : 0, skipped: 0, deleted: 0 };
}

export async function resetUsers(ctx: SeedContext): Promise<SeedStats> {
  const prisma = ctx.prisma as PrismaClient;
  const { logger } = ctx;

  const result = await prisma.user.deleteMany({ where: { email: SEED_ADMIN_EMAIL } });

  logger.info(`Users reset complete: deleted=${result.count}`);
  return { created: 0, updated: 0, skipped: 0, deleted: result.count };
}

function resolveAdminPassword(): string {
  const envPassword = process.env['SEED_ADMIN_PASSWORD'];
  const nodeEnv = process.env['NODE_ENV'] ?? 'development';
  const isProduction = nodeEnv === 'production';

  if (envPassword && envPassword.length > 0) {
    return envPassword;
  }

  if (isProduction) {
    console.error(
      `[SEED] FATAL: SEED_ADMIN_PASSWORD environment variable is required in production. ` +
      `Set it to a strong password before running the seed.`,
    );
    process.exit(1);
  }

  console.warn(
    `[SEED] WARN: SEED_ADMIN_PASSWORD not set. Using dev-only fallback password in ${nodeEnv} mode. ` +
    `Do NOT use this fallback in production.`,
  );
  return DEV_FALLBACK_PASSWORD;
}