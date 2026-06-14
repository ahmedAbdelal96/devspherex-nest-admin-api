/**
 * Seed Logger
 *
 * Structured logger for seed operations.
 * Does NOT log passwords, tokens, hashes, or secrets.
 */

import type { SeedLogger, SeedStats } from './seed.types';

const RESET_PREFIX = '[SEED-RESET]';
const UPSERT_PREFIX = '[SEED]';
const MODULE_PREFIX = '[MODULE]';

function sanitizeMeta(meta: Record<string, unknown> = {}): Record<string, unknown> {
  const sensitive = ['password', 'token', 'hash', 'secret', 'key', 'credential', 'otp'];
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    const lower = k.toLowerCase();
    if (sensitive.some((s) => lower.includes(s))) {
      sanitized[k] = '[REDACTED]';
    } else if (typeof v === 'string') {
      sanitized[k] = v;
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

export class SeedLoggerImpl implements SeedLogger {
  private prefix: string;

  constructor(mode: 'upsert' | 'reset') {
    this.prefix = mode === 'reset' ? RESET_PREFIX : UPSERT_PREFIX;
  }

  private log(level: string, message: string, meta?: Record<string, unknown>): void {
    const ts = new Date().toISOString();
    const metaStr = meta && Object.keys(meta).length > 0
      ? ` ${JSON.stringify(sanitizeMeta(meta))}`
      : '';
    console.log(`${ts} ${level} ${this.prefix} ${message}${metaStr}`);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('INFO', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('WARN', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('ERROR', message, meta);
  }

  success(message: string, meta?: Record<string, unknown>): void {
    this.log('SUCCESS', message, meta);
  }

  startModule(name: string): void {
    this.info(`${MODULE_PREFIX} Starting: ${name}`);
  }

  endModule(name: string, stats: SeedStats): void {
    const parts: string[] = [];
    if (stats.created > 0) parts.push(`created=${stats.created}`);
    if (stats.updated > 0) parts.push(`updated=${stats.updated}`);
    if (stats.skipped > 0) parts.push(`skipped=${stats.skipped}`);
    if (stats.deleted > 0) parts.push(`deleted=${stats.deleted}`);
    const statStr = parts.length > 0 ? ` (${parts.join(', ')})` : '';
    this.success(`${MODULE_PREFIX} Completed: ${name}${statStr}`);
  }

  resetWarning(message: string): void {
    console.warn(`${RESET_PREFIX} DANGER: ${message}`);
  }

  startReset(): void {
    this.resetWarning('RESET MODE ACTIVATED — deleting seed-owned records');
  }

  startUpsert(): void {
    this.info('Starting seed in upsert mode — existing records will be preserved');
  }
}

export function createSeedLogger(mode: 'upsert' | 'reset'): SeedLoggerImpl {
  return new SeedLoggerImpl(mode);
}