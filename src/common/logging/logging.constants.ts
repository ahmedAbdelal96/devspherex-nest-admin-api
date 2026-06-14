/**
 * Logging Constants
 *
 * Central source of truth for all logging-related constants.
 */

export const LOG_DIR = 'logs';
export const LOG_APP_FILE = 'application-%DATE%.log';
export const LOG_ERROR_FILE = 'error-%DATE%.log';
export const LOG_EXCEPTIONS_FILE = 'exceptions-%DATE%.log';
export const LOG_REJECTIONS_FILE = 'rejections-%DATE%.log';

export const LOG_FILE_MAX_SIZE = '20m';
export const LOG_RETENTION_DAYS = 14;

export const LOG_DATE_PATTERN = 'YYYY-MM-DD';

export const LOG_LEVELS = ['error', 'warn', 'info', 'http', 'verbose', 'debug'] as const;

export const DEFAULT_CONSOLE_FORMAT = 'pretty';
export const DEFAULT_FILE_FORMAT = 'json';