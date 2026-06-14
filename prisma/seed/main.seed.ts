/**
 * Main Seed Runner
 *
 * Orchestrates all module seeders in dependency order.
 * Default mode: upsert (safe, idempotent).
 * Reset mode: guarded by ALLOW_SEED_RESET env var.
 */

import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { getSeeders, getSeedersReversed } from './seed.registry';
import { createSeedLogger } from './seed.logger';
import type { SeedContext, SeedMode } from './seed.types';

// ─── Mode Parsing ─────────────────────────────────────────────────────────────

function parseMode(): SeedMode {
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg.startsWith('--mode=')) {
      const value = arg.split('=')[1]!.trim().toLowerCase();
      if (value === 'reset') return 'reset';
      if (value === 'upsert') return 'upsert';
      console.error(`[SEED] Unknown mode: "${value}". Use --mode=upsert or --mode=reset`);
      process.exit(1);
    }
  }
  return 'upsert';
}

function isResetAllowed(): boolean {
  return process.env['ALLOW_SEED_RESET'] === 'true';
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const mode = parseMode();
  const logger = createSeedLogger(mode);

  // Guard reset mode
  if (mode === 'reset') {
    if (!isResetAllowed()) {
      logger.error(
        'Reset mode requires ALLOW_SEED_RESET=true environment variable. ' +
        ' refusing to run to protect production data.',
      );
      console.error('[SEED] FATAL: Reset guard rejected. Set ALLOW_SEED_RESET=true to proceed.');
      process.exit(1);
    }
    logger.startReset();
  } else {
    logger.startUpsert();
  }

  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({
    adapter,
    log: mode === 'reset' ? (['error', 'warn'] as const) : (['error'] as const),
  } satisfies Prisma.PrismaClientOptions);

  const seeders = getSeeders();
  const resetSeeders = getSeedersReversed();

  const ctx: SeedContext = {
    prisma,
    mode,
    logger,
  };

  try {
    if (mode === 'reset') {
      // Reset: run reset functions in reverse dependency order
      for (const seeder of resetSeeders) {
        if (!seeder.reset) {
          logger.warn(`Seeder "${seeder.name}" has no reset function — skipping`);
          continue;
        }
        logger.startModule(seeder.name);
        const stats = await seeder.reset(ctx);
        logger.endModule(seeder.name, stats);
      }

      // After reset, run seed functions in normal order to recreate
      for (const seeder of seeders) {
        logger.startModule(seeder.name);
        const stats = await seeder.seed(ctx);
        logger.endModule(seeder.name, stats);
      }
    } else {
      // Upsert: run seed functions in dependency order
      for (const seeder of seeders) {
        logger.startModule(seeder.name);
        const stats = await seeder.seed(ctx);
        logger.endModule(seeder.name, stats);
      }
    }

    logger.success(`Seed completed successfully in ${mode} mode`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Seed failed: ${message}`);
    console.error('[SEED] FATAL:', message);
    await prisma.$disconnect();
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();