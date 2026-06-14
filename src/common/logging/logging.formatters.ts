/**
 * Logging Formatters
 *
 * Winston formatters for console (pretty) and file (JSON) output.
 * Console: colored, human-readable.
 * Files: structured JSON or simple text (no ANSI codes).
 */

import { format } from 'winston';

const { timestamp, printf, colorize, errors, combine } = format;

/**
 * Human-readable console format for development.
 * Includes: timestamp, level, context, message, requestId, stack.
 */
export function prettyConsoleFormat(): ReturnType<typeof format.combine> {
  return combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    colorize({ all: true }),
    errors({ stack: true }),
    printf(({ level, message, context, requestId, userId, userEmail, stack, timestamp: ts, ...meta }) => {
      let line = `[${ts}] ${level.toUpperCase()}`;
      if (context) line += ` [${context}]`;
      line += ` ${message}`;
      if (requestId) line += ` requestId=${requestId}`;
      if (userId) line += ` userId=${userId}`;
      if (userEmail) line += ` userEmail=${userEmail}`;
      // Print safe meta fields (skip known large/safe fields)
      const safeMeta = { ...meta };
      // Remove stack from meta display since we show it separately
      delete safeMeta['stack'];
      const metaKeys = Object.keys(safeMeta).filter(
        (k) => k !== 'level' && k !== 'message' && k !== 'context' && k !== 'timestamp' && k !== 'requestId' && k !== 'userId' && k !== 'userEmail',
      );
      if (metaKeys.length > 0) {
        const metaPreview: string[] = [];
        for (const key of metaKeys.slice(0, 5)) {
          const val = safeMeta[key];
          const valStr = typeof val === 'string' ? val.substring(0, 50) : JSON.stringify(val)?.substring(0, 50);
          metaPreview.push(`${key}=${valStr}`);
        }
        line += ` ${metaPreview.join(' ')}`;
      }
      if (stack) line += `\n${stack}`;
      return line;
    }),
  );
}

/**
 * Simple non-colored format for file output (no ANSI codes).
 */
export function simpleFileFormat(): ReturnType<typeof format.combine> {
  return combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    printf(({ level, message, context, requestId, userId, userEmail, timestamp: ts, stack, ...meta }) => {
      const base = `[${ts}] ${level.toUpperCase()} [${context ?? '-'}] ${message}`;
      const extras: string[] = [];
      if (requestId) extras.push(`requestId=${requestId}`);
      if (userId) extras.push(`userId=${userId}`);
      if (userEmail) extras.push(`userEmail=${userEmail}`);
      if (stack) extras.push(`stack=${stack}`);
      const metaPart = Object.entries(meta)
        .filter(([k]) => !['level', 'message', 'context', 'timestamp', 'requestId', 'userId', 'userEmail', 'stack'].includes(k))
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(' ');
      if (metaPart) extras.push(metaPart);
      return extras.length > 0 ? `${base} ${extras.join(' ')}` : base;
    }),
  );
}

/**
 * JSON file format for structured production logs.
 */
export function jsonFileFormat(): ReturnType<typeof format.combine> {
  return combine(
    timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    errors({ stack: true }),
    format.json(),
  );
}