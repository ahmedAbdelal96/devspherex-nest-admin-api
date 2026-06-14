/**
 * Logging Service
 *
 * Centralized Winston-based logging service compatible with NestJS LoggerService.
 * - Single global logger instance
 * - Sensitive data redaction before logging
 * - Daily file rotation (application, error, exceptions, rejections)
 * - Colored pretty console in development
 * - Structured JSON files in production
 */

import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import { buildLoggingConfig, getNodeEnv } from './logging.config';
import { prettyConsoleFormat, simpleFileFormat, jsonFileFormat } from './logging.formatters';
import { redactSensitiveData } from './logging.redactor';
import {
  LOG_APP_FILE,
  LOG_ERROR_FILE,
  LOG_EXCEPTIONS_FILE,
  LOG_REJECTIONS_FILE,
  LOG_DATE_PATTERN,
} from './logging.constants';
import { AppLogMeta } from './logging.types';

type WinstonLevel = 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug';

// Global Winston logger instance
let globalLogger: winston.Logger | null = null;

function createDailyTransport(opts: {
  filename: string;
  level: string;
  dirname: string;
  datePattern: string;
  maxSize: string;
  maxFiles: string | number;
  json: boolean;
  format: winston.Logform.Format;
}): DailyRotateFile {
  return new DailyRotateFile({
    filename: opts.filename,
    dirname: opts.dirname,
    datePattern: opts.datePattern,
    maxSize: opts.maxSize,
    maxFiles: opts.maxFiles,
    level: opts.level,
    json: opts.json,
    format: opts.format,
    auditFile: `${opts.dirname}/.audit-${opts.filename}.json`,
  });
}

function buildWinstonLogger(config: ReturnType<typeof buildLoggingConfig>): winston.Logger {
  const transports: winston.transport[] = [];

  // Console transport
  if (config.toConsole) {
    transports.push(
      new winston.transports.Console({
        level: config.level,
        format: config.prettyConsole ? prettyConsoleFormat() : simpleFileFormat(),
      }),
    );
  }

  // File transports
  if (config.toFile) {
    const fileFormat = config.jsonFile ? jsonFileFormat() : simpleFileFormat();

    // Application log — all levels
    transports.push(
      createDailyTransport({
        filename: LOG_APP_FILE,
        level: config.level,
        dirname: config.dir,
        datePattern: LOG_DATE_PATTERN,
        maxSize: config.fileMaxSize,
        maxFiles: `${config.fileRetentionDays}d`,
        json: config.jsonFile,
        format: fileFormat,
      }),
    );

    // Error log — error level only
    transports.push(
      createDailyTransport({
        filename: LOG_ERROR_FILE,
        level: 'error',
        dirname: config.dir,
        datePattern: LOG_DATE_PATTERN,
        maxSize: config.fileMaxSize,
        maxFiles: `${config.fileRetentionDays}d`,
        json: config.jsonFile,
        format: fileFormat,
      }),
    );

    // Exceptions log
    transports.push(
      createDailyTransport({
        filename: LOG_EXCEPTIONS_FILE,
        level: 'error',
        dirname: config.dir,
        datePattern: LOG_DATE_PATTERN,
        maxSize: config.fileMaxSize,
        maxFiles: `${config.fileRetentionDays}d`,
        json: config.jsonFile,
        format: fileFormat,
      }),
    );

    // Rejections log
    transports.push(
      createDailyTransport({
        filename: LOG_REJECTIONS_FILE,
        level: 'error',
        dirname: config.dir,
        datePattern: LOG_DATE_PATTERN,
        maxSize: config.fileMaxSize,
        maxFiles: `${config.fileRetentionDays}d`,
        json: config.jsonFile,
        format: fileFormat,
      }),
    );
  }

  const logger = winston.createLogger({
    level: config.level,
    transports,
    // Prevent exit on error during exception/rejection handling
    exceptionHandlers: [],
    rejectionHandlers: [],
    exitOnError: false,
  });

  return logger;
}

function getOrCreateLogger(): winston.Logger {
  if (!globalLogger) {
    const config = buildLoggingConfig();
    globalLogger = buildWinstonLogger(config);
  }
  return globalLogger;
}

const VALID_LEVELS: readonly string[] = ['debug', 'info', 'warn', 'error', 'verbose', 'http'];

function isValidLevel(value: string): boolean {
  return VALID_LEVELS.includes(value);
}

/**
 * Logging Service
 *
 * NestJS-compatible LoggerService wrapping Winston.
 * All metadata is redacted of sensitive values before logging.
 * Handles Error objects with stack traces.
 */
@Injectable()
export class LoggingService implements LoggerService {
  private readonly logger: winston.Logger;
  private readonly isTest: boolean;

  constructor() {
    this.logger = getOrCreateLogger();
    this.isTest = getNodeEnv() === 'test';
  }

  /**
   * Central log dispatcher — handles all NestJS LoggerService signatures:
   * - log(message, context?)
   * - log(level, message, context?, meta?)
   */
  log(messageOrLevel: string, contextOrMessage?: string | Record<string, unknown>, maybeMeta?: Record<string, unknown>): void {
    if (this.isTest) return;

    // Detect which signature is being used based on whether the first arg is a valid log level
    if (isValidLevel(messageOrLevel)) {
      // log(level, message, context?, meta?)
      const level = messageOrLevel as WinstonLevel;
      const message = typeof contextOrMessage === 'string' ? contextOrMessage : messageOrLevel;
      const context = typeof contextOrMessage === 'string' ? undefined : undefined;
      const meta = maybeMeta ?? (typeof contextOrMessage === 'object' && contextOrMessage !== null ? contextOrMessage : undefined);
      this.emit(level, message, context, meta as AppLogMeta | undefined);
    } else {
      // log(message, context?, meta?)
      const message = messageOrLevel;
      const context = typeof contextOrMessage === 'string' ? contextOrMessage : undefined;
      const meta = maybeMeta ?? (typeof contextOrMessage === 'object' && contextOrMessage !== null ? contextOrMessage as AppLogMeta : undefined);
      this.emit('info', message, context, meta);
    }
  }

  info(message: string, context?: string, meta?: AppLogMeta): void {
    this.emit('info', message, context, meta);
  }

  warn(message: string, context?: string, meta?: AppLogMeta): void {
    this.emit('warn', message, context, meta);
  }

  error(message: string, context?: string, meta?: AppLogMeta): void {
    this.emit('error', message, context, meta);
  }

  debug(message: string, context?: string, meta?: AppLogMeta): void {
    this.emit('debug', message, context, meta);
  }

  verbose(message: string, context?: string, meta?: AppLogMeta): void {
    this.emit('verbose', message, context, meta);
  }

  /**
   * Get the raw Winston logger — used by app.useLogger().
   */
  getLogger(): winston.Logger {
    return this.logger;
  }

  private emit(level: WinstonLevel, message: string, context?: string, meta?: AppLogMeta): void {
    if (this.isTest) return;
    const redactedMeta = this.buildMeta(level, context, meta);
    this.logger.log(level, message, redactedMeta);
  }

  private buildMeta(level: WinstonLevel, context?: string, meta?: AppLogMeta): AppLogMeta {
    if (!meta) {
      return { context, environment: getNodeEnv() };
    }
    // Redact sensitive fields from meta
    const redactedMeta = redactSensitiveData(meta ?? {});
    return {
      ...redactedMeta,
      context,
      environment: getNodeEnv(),
    };
  }
}

/**
 * Get the global Winston logger instance.
 * Useful for exception/rejection handlers.
 */
export function getGlobalWinstonLogger(): winston.Logger {
  return getOrCreateLogger();
}

/**
 * Configure global unhandled exception and rejection handlers.
 * Call once during bootstrap.
 */
export function setupGlobalExceptionHandlers(): void {
  const logger = getOrCreateLogger();

  process.on('uncaughtException', (err: Error) => {
    logger.error(`Uncaught Exception: ${err.message}`, {
      context: 'Process',
      stack: err.stack,
      errorCode: 'UNCAUGHT_EXCEPTION',
    });
  });

  process.on('unhandledRejection', (reason: unknown) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    logger.error(`Unhandled Rejection: ${msg}`, {
      context: 'Process',
      stack,
      errorCode: 'UNHANDLED_REJECTION',
    });
  });
}