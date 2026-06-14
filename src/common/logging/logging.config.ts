/**
 * Logging Config
 *
 * Builds Winston logger configuration from environment variables.
 * Provides type-safe defaults per environment.
 */

import { LoggingConfig, LogLevel } from './logging.types';
import {
  LOG_DIR,
  LOG_FILE_MAX_SIZE,
  LOG_RETENTION_DAYS,
} from './logging.constants';

const nodeEnv = process.env['NODE_ENV'] || 'development';

function resolveLogLevel(env: typeof process.env): LogLevel {
  const level = env['LOG_LEVEL'];
  const validLevels: LogLevel[] = ['error', 'warn', 'info', 'http', 'verbose', 'debug'];
  if (level && validLevels.includes(level as LogLevel)) {
    return level as LogLevel;
  }
  return nodeEnv === 'production' ? 'info' : 'debug';
}

function resolveBool(env: typeof process.env, key: string, defaultVal: boolean): boolean {
  const val = env[key];
  if (val === undefined) return defaultVal;
  return val === 'true' || val === '1';
}

export function buildLoggingConfig(): LoggingConfig {
  // In test environment, default to silenced
  const isTest = nodeEnv === 'test';

  return {
    level: resolveLogLevel(process.env),
    toConsole: isTest ? false : resolveBool(process.env, 'LOG_TO_CONSOLE', true),
    toFile: isTest ? false : resolveBool(process.env, 'LOG_TO_FILE', true),
    dir: process.env['LOG_DIR'] || LOG_DIR,
    fileMaxSize: process.env['LOG_FILE_MAX_SIZE'] || LOG_FILE_MAX_SIZE,
    fileRetentionDays:
      parseInt(process.env['LOG_RETENTION_DAYS'] || String(LOG_RETENTION_DAYS), 10),
    prettyConsole: resolveBool(process.env, 'LOG_PRETTY_CONSOLE', nodeEnv !== 'production'),
    jsonFile: resolveBool(process.env, 'LOG_JSON_FILE', nodeEnv === 'production'),
    silenced: isTest,
  };
}

export function getNodeEnv(): string {
  return nodeEnv;
}