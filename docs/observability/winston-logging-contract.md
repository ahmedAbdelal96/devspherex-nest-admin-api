# Winston Logging Contract

**Date:** 2026-06-14
**Phase:** 10

---

## Overview

Phase 10 adds a centralized Winston-based logging system with daily file rotation, sensitive data redaction, and environment-aware formatting. The logging system is integrated at the application bootstrap level and handles all uncaught exceptions and unhandled rejections.

---

## Architecture

### Module Location

```
src/common/logging/
├── index.ts                    # Public API barrel export
├── logging.module.ts          # @Global() NestJS module
├── logging.service.ts         # NestJS LoggerService implementation (Winston)
├── logging.service.spec.ts    # Unit tests
├── logging.config.ts         # Environment-driven config builder
├── logging.constants.ts      # Filenames, sizes, retention constants
├── logging.types.ts          # TypeScript types
├── logging.formatters.ts     # Pretty console, simple file, JSON file formatters
├── logging.redactor.ts        # Deep sensitive data redaction
└── logging.redactor.spec.ts  # Redaction unit tests
```

### Integration Points

| File | Change |
|---|---|
| `src/main.ts` | Calls `setupGlobalExceptionHandlers()` before `NestFactory.create()`, uses `app.useLogger(loggingService)` |
| `src/app.module.ts` | Imports `LoggingModule` |
| `src/common/errors/app-exception.filter.ts` | Injects optional `LoggingService`, logs Prisma errors and unhandled exceptions |

---

## Log Files

All files are written to the directory specified by `LOG_DIR` (default: `logs/`). The `logs/` directory is gitignored.

| File Pattern | Level | Purpose |
|---|---|---|
| `application-%DATE%.log` | All levels | General application logs |
| `error-%DATE%.log` | `error` only | Error-level entries from application log |
| `exceptions-%DATE%.log` | `error` only | Uncaught exceptions (via global handlers) |
| `rejections-%DATE%.log` | `error` only | Unhandled promise rejections |

- **Rotation:** Daily (`YYYY-MM-DD` pattern)
- **Max size:** 20MB per file (configurable via `LOG_FILE_MAX_SIZE`)
- **Retention:** 14 days (configurable via `LOG_RETENTION_DAYS`)
- **Audit file:** `.audit-application-%DATE%.log.json` (Winston internal)

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `debug` (dev), `info` (prod) | Minimum log level |
| `LOG_TO_CONSOLE` | `true` | Enable console output |
| `LOG_TO_FILE` | `true` | Enable file output |
| `LOG_DIR` | `logs` | Log file directory |
| `LOG_FILE_MAX_SIZE` | `20m` | Max size per file |
| `LOG_RETENTION_DAYS` | `14` | Days to retain files |
| `LOG_PRETTY_CONSOLE` | `true` (dev), `false` (prod) | Colored pretty console |
| `LOG_JSON_FILE` | `false` (dev), `true` (prod) | JSON file format |

---

## Formatting

### Development (Pretty Console)

Human-readable colored output with ANSI colors:
```
[2026-06-14 14:32:11] INFO  [AuthService] Login attempt environment=development
  → requestId: req-abc123
  → userId: user-1
  → path: /auth/login
```

### Production (JSON File)

Structured JSON — each line is a valid JSON object:
```json
{"level":"info","message":"Login attempt","context":"AuthService","requestId":"req-abc123","userId":"user-1","environment":"production","timestamp":"2026-06-14T14:32:11.000Z"}
```

### File Format (Non-JSON)

Plain text without ANSI codes — safe for log parsers:
```
2026-06-14 14:32:11 INFO [AuthService] Login attempt requestId=req-abc123 userId=user-1 environment=development
```

---

## Sensitive Data Redaction

The `redactSensitiveData()` function recursively traverses objects and replaces values of sensitive keys with `[REDACTED]`. Circular references are detected and handled safely.

### Sensitive Key Patterns (30 total)

`password`, `passwd`, `token`, `accessToken`, `refreshToken`, `idToken`, `apiKey`, `api_key`, `secret`, `auth`, `authorization`, `bearer`, `credential`, `credentials`, `privateKey`, `private_key`, `publicKey`, `public_key`, `session`, `sessionId`, `session_id`, `cookie`, `csrf`, `otp`, `totp`, `resetToken`, `reset_token`, `hash`, `pepper`, `jwt`, `devOtp`

Matching is **case-insensitive** and checks for exact key matches and patterns (e.g. `X-API-KEY` matches `apiKey`).

### Examples

```typescript
redactSensitiveData({ password: 'secret123' })
// → { password: '[REDACTED]' }

redactSensitiveData({ user: { name: 'Alice', apiKey: 'key-xyz' } })
// → { user: { name: 'Alice', apiKey: '[REDACTED]' } }

redactSensitiveData([{ token: 'tok1' }, { token: 'tok2' }])
// → [{ token: '[REDACTED]' }, { token: '[REDACTED]' }]
```

---

## Global Exception Handlers

`setupGlobalExceptionHandlers()` is called **before** `NestFactory.create()` to ensure all exceptions from the earliest bootstrap code are captured:

```typescript
process.on('uncaughtException', (err: Error) => {
  logger.error(`Uncaught Exception: ${err.message}`, {
    context: 'Process',
    stack: err.stack,
    errorCode: 'UNCAUGHT_EXCEPTION',
  });
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error(`Unhandled Rejection: ${msg}`, {
    context: 'Process',
    stack,
    errorCode: 'UNHANDLED_REJECTION',
  });
});
```

---

## NestJS LoggerService Compatibility

`LoggingService` implements NestJS's `LoggerService` interface. It handles both method signatures:

```typescript
// message-only (logs at info level)
logger.log('Application started', 'Bootstrap');

// level-aware dispatch
logger.log('info', 'User logged in', 'AuthService', { userId: 'user-1' });
```

Methods: `log()`, `info()`, `warn()`, `error()`, `debug()`, `verbose()`

All metadata passed to any method is redacted before logging.

---

## Backward Compatibility

- `GlobalExceptionFilter` accepts an **optional** `LoggingService` — existing tests that call `new GlobalExceptionFilter()` without arguments continue to work
- When no `LoggingService` is provided, `doLog = false` and all logging calls are no-ops
- `LoggingService` is silent in `test` environment (`NODE_ENV=test`) to keep test output clean
