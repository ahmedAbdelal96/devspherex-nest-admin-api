/**
 * Seed Types
 *
 * Shared types for the modular Prisma seed system.
 */

export type SeedMode = 'upsert' | 'reset';

export interface SeedLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  success(message: string, meta?: Record<string, unknown>): void;
}

export interface SeedContext {
  prisma: unknown;
  mode: SeedMode;
  logger: SeedLogger;
}

export interface SeedStats {
  created: number;
  updated: number;
  skipped: number;
  deleted: number;
}

export interface ModuleSeeder {
  name: string;
  dependencies?: string[];
  seed: (ctx: SeedContext) => Promise<SeedStats>;
  reset?: (ctx: SeedContext) => Promise<SeedStats>;
}