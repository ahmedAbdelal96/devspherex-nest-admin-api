/**
 * Seed Runner Helpers
 *
 * Pure functions extracted from main.seed.ts for testability.
 * These functions have no side effects and are easy to unit-test.
 */

import type { SeedMode } from './seed.types';

/**
 * Parse seed mode from CLI arguments.
 * Default: 'upsert'
 * --mode=upsert → 'upsert'
 * --mode=reset  → 'reset'
 * anything else → exits process with error
 */
export function parseSeedMode(args: string[]): SeedMode {
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

/**
 * Check if reset mode is allowed via environment variable.
 */
export function isResetAllowed(env: typeof process.env): boolean {
  return env['ALLOW_SEED_RESET'] === 'true';
}