/**
 * Logging Types
 *
 * Shared types for the Winston logging system.
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug';

export type ConsoleFormat = 'pretty' | 'simple';

export type FileFormat = 'json' | 'simple';

export interface LogFileConfig {
  dirname: string;
  filename: string;
  maxSize: string;
  maxFiles: string | number;
  datePattern: string;
  level: LogLevel;
  json: boolean;
}

export interface RequestContextFields {
  requestId?: string;
  userId?: string;
  userEmail?: string;
  userRoleId?: string;
  method?: string;
  path?: string;
  route?: string;
  statusCode?: number;
  durationMs?: number;
  errorCode?: string;
}

export interface AppLogMeta extends RequestContextFields {
  environment?: string;
  service?: string;
  context?: string;
  stack?: string;
}

export interface LoggingConfig {
  level: LogLevel;
  toConsole: boolean;
  toFile: boolean;
  dir: string;
  fileMaxSize: string;
  fileRetentionDays: number;
  prettyConsole: boolean;
  jsonFile: boolean;
  silenced: boolean;
}

export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
};