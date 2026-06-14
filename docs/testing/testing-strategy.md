# Testing Strategy

**Date:** 2026-06-14
**Phase:** 10

---

## Overview

This project uses **Jest** for unit testing. The goal is to provide a meaningful test foundation that covers security-sensitive business logic without requiring a live database or external providers.

---

## Where Tests Live

Tests are placed next to the files they test, following the NestJS convention:

```
src/
  common/
    api-response/
      api-response.interceptor.spec.ts       ← response wrapping + marker leakage
    errors/
      app-exception.filter.spec.ts            ← exception filter mapping + exceptionFactory
      validation-error.formatter.spec.ts      ← validation formatting + dot-paths
      validation-error.integration.spec.ts    ← HTTP-level validation/error contract tests
    request-context/
      request-id.util.spec.ts                 ← request ID generation/reuse
  modules/auth/password-recovery/
    password-recovery-channel-readiness.spec.ts   ← channel readiness tests
    password-recovery-config.spec.ts               ← config boot rules
    services/
      password-recovery-hashing.service.spec.ts   ← hashing logic
      password-recovery-token.service.spec.ts     ← token generation
    use-cases/
      request-password-recovery.use-case.spec.ts   ← request use-case
      verify-password-recovery-otp.use-case.spec.ts ← verify use-case
      reset-password-with-token.use-case.spec.ts   ← reset use-case
  common/rbac/
    decorators/
      permissions.decorator.spec.ts               ← decorator metadata
    guards/
      permissions.guard.spec.ts                  ← guard logic
    services/
      effective-permissions.service.spec.ts      ← permission computation
    system-permissions.spec.ts                   ← key contract validation
  modules/auth/
    strategies/
      jwt.strategy.spec.ts                       ← JWT validation
    services/
      refresh-token.service.spec.ts              ← refresh token logic
    use-cases/
      logout-all.use-case.spec.ts                ← logout-all logic
  modules/audit-logs/
    constants/
      audit-actions.spec.ts                      ← action registry + uniqueness
    mappers/
      audit-log-response.mapper.spec.ts          ← DB → client response mapping
    repositories/
      audit-logs.repository.spec.ts             ← create, findAll, findById
    services/
      audit-log-sanitizer.service.spec.ts        ← recursive sanitization
      audit-log.service.spec.ts                  ← non-blocking audit logging (before/after/metadata separate)
    utils/
      audit-context.util.spec.ts                 ← request context + actor extraction
  modules/api-request-logs/
    interceptors/
      api-request-observability.interceptor.spec.ts  ← unit: success/failure logging, skip paths, user/IP extraction, errorCode
      api-request-observability.integration.spec.ts  ← integration: real HTTP via supertest, Phase 6 contract preserved
    repositories/
      api-request-logs.repository.spec.ts           ← create, findAll, findById
    services/
      api-request-log.service.spec.ts                ← non-blocking logging behavior
  test-utils/
    mocks.ts                                     ← shared mock factories
  common/swagger/
    api-standard-response.decorators.spec.ts    ← decorator application + schema generation
    swagger.config.spec.ts                       ← environment-aware Swagger setup
```

---

## How to Run Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run smoke test (runtime boot verification)
npm run test:smoke
```

---

## What Unit Tests Mock

| Dependency | How It's Mocked |
|---|---|
| `ConfigService` | `createMockConfigService()` from `src/test-utils/mocks.ts` |
| `PrismaService` | `createMockPrismaService()` — chainable mock with jest fns |
| `Reflector` | `createMockReflector()` — returns configured values per key |
| `ExecutionContext` | `createMockExecutionContext(request)` — returns mock request |
| `PasswordRecoveryConfig` | Real class instantiated with mock ConfigService |
| `PasswordRecoveryHashingService` | Real class instantiated with mock config |
| `PasswordRecoveryTokenService` | Real class instantiated with mock config |
| `PasswordRecoveryPolicyService` | Real class instantiated with mock config |
| `PasswordRecoveryChannelService` | Inline mock `{ sendOtp: jest.fn() }` |
| `PasswordRecoveryRepository` | Inline mock with jest fns per method |
| `PasswordService` | Inline mock `{ hashPassword: jest.fn().mockResolvedValue('hash') }` |
| `AuditLogsRepository` | Inline mock `{ create: jest.fn(), findAll: jest.fn(), findById: jest.fn() }` |
| `PrismaService` | Inline mock with `jest.fn()` per auditLog method (`create`, `findMany`, `findUnique`, `count`) |

**Key principle:** Unit tests test the **logic** — mocks handle the **infrastructure**. No real database, no real SMTP, no real WhatsApp.

---

## Smoke Test

**File:** `scripts/smoke-boot.mjs`

A standalone Node.js script (not a Jest test) that verifies the application actually boots:

1. Spawns `npm run start` with `PORT=3105`
2. Captures stdout/stderr
3. Waits for the string `"Nest application successfully started"`
4. Kills the child process
5. Exits 0 on success, 1 on failure/timeout (30s timeout)

```bash
npm run test:smoke
```

---

## Quality Gate

The `quality:check` script runs a full quality chain:

```bash
npm run quality:check
```

Chain:
1. `npm run lint` — ESLint with auto-fix
2. `npm run build` — NestJS build
3. `npx prisma validate` — Prisma schema validation
4. `npx ts-node scripts/validate-permissions.ts` — Permission key contract
5. `npm run test` — Jest test suite

This is the **recommended check before committing**.

---

## Current Limitations

- **No EMAIL/WHATSAPP/SMS provider tests** — channels are not implemented
- **Smoke test** requires port 3105 to be free
- **No audit log retention/expiry policy** — logs stored indefinitely
- **No SIEM export** — audit logs not streamed to external systems

---

## Why HTTP-Level Integration Tests for Response/Error Contract

Unit tests for `ApiResponseInterceptor` and `GlobalExceptionFilter` verify the logic in isolation. But response/error contracts have a critical requirement: **the JSON that actually reaches the HTTP client must not leak internal markers or sensitive data**.

This cannot be fully verified with unit tests alone because:

1. `Object.keys()` on a mock doesn't prove `JSON.stringify()` hides the property
2. A mock `ExecutionContext` doesn't exercise the real Express request/response pipeline
3. The `ValidationPipe` `exceptionFactory` behavior can only be verified end-to-end

Therefore, `validation-error.integration.spec.ts` creates a **minimal NestJS app** with:
- Same `ValidationPipe` config as `main.ts`
- Same `GlobalExceptionFilter` wiring
- Same `ApiResponseInterceptor` wiring
- Same `requestIdMiddleware` wiring

It uses `supertest` to make real HTTP calls and verify the actual JSON responses.

This approach:
- Does not require a real database
- Does not require the full application
- Verifies the actual HTTP contract (headers, status codes, JSON body shape)
- Catches integration issues that unit tests miss

```bash
# Run integration tests with unit tests
npm run test

# Run coverage (includes integration tests)
npm run test:cov
```

---

## Adding New Tests

1. Create a `*.spec.ts` file next to the file you want to test
2. Import the module under test
3. Use `createMockConfigService()` / `createMockPrismaService()` from `src/test-utils/mocks.ts`
4. For service logic, prefer instantiating the real class with mock dependencies over mocking the entire service
5. Group related cases with `describe()` blocks
6. Use `it()` with clear descriptions: "rejects when X" / "allows when Y"

```typescript
import { PasswordRecoveryTokenService } from './password-recovery-token.service';
import { createMockConfigService } from '../../../test-utils/mocks';

function buildService(otpLength = 6) {
  return new PasswordRecoveryTokenService(
    createMockConfigService({ 'passwordRecovery.otpLength': String(otpLength) }) as never,
  );
}

describe('PasswordRecoveryTokenService', () => {
  describe('generateOtp', () => {
    it('produces a string of configured length', () => {
      const svc = buildService(6);
      expect(svc.generateOtp()).toHaveLength(6);
    });
  });
});
```

---

## Phase 10 — Winston Logging Tests

**Files:**
- `src/common/logging/logging.service.spec.ts`
- `src/common/logging/logging.redactor.spec.ts`

### `logging.service.spec.ts`

Tests the Winston-based `LoggingService` without requiring a real database or writing actual log files. Uses `jest.resetModules()` + `jest.requireActual()` to re-import the config module with fresh `process.env` values for environment-dependent tests.

```bash
npm run test -- --testPathPattern="logging.service.spec"
```

| Test group | What it verifies |
|---|---|
| `LoggingService` — construction | Service instantiates without throwing |
| `LoggingService` — log methods | `info()`, `warn()`, `error()`, `debug()`, `verbose()`, `log()` (both signatures) do not throw |
| `LoggingService` — sensitive data redaction | Sensitive metadata is redacted before logging (password, token, accessToken, authorization, etc.) |
| `LoggingService` — deeply nested sensitive data | Nested objects and arrays with sensitive fields are fully redacted |
| `LoggingService` — Error with stack | Error objects with stack traces are handled without throwing |
| `buildLoggingConfig` — level defaults | `debug` in dev, `info` in prod, silenced in test |
| `buildLoggingConfig` — env var overrides | `LOG_LEVEL`, `LOG_TO_CONSOLE`, `LOG_TO_FILE`, `LOG_DIR`, `LOG_FILE_MAX_SIZE`, `LOG_RETENTION_DAYS`, `LOG_PRETTY_CONSOLE`, `LOG_JSON_FILE` |
| `getNodeEnv` | Returns current `NODE_ENV`, defaults to `'development'` |

> Note: `LoggingService` is fully silent when `NODE_ENV=test` — this keeps test output clean. Actual file writing is not verified in unit tests (requires integration test with temporary directory).

### `logging.redactor.spec.ts`

Tests the deep redaction function with 30 sensitive patterns:

```bash
npm run test -- --testPathPattern="logging.redactor.spec"
```

| Test group | What it verifies |
|---|---|
| Primitives | `null`, `undefined`, strings, numbers, booleans pass through unchanged |
| Top-level sensitive fields | `password`, `token`, `accessToken`, `refreshToken`, `authorization`, `apiKey`, `secret`, `cookie`, `otp`, `resetToken`, `hash`, `jwt`, `devOtp`, etc. → `[REDACTED]` |
| Nested objects | Deeply nested sensitive values are redacted at all levels |
| Arrays | Arrays of objects with sensitive fields are fully redacted |
| Case-insensitivity | `PASSWORD`, `Password`, `password` all match |
| Safe fields | `name`, `email`, `id`, `createdAt` pass through unchanged |
| No mutation | Original object is not modified |
| Empty objects/arrays | Handled without throwing |

---

## Phase 9 — Seed System Tests

**File:** `src/test-utils/seed.spec.ts`

Tests seed registry validation, helper functions, logger sanitization, and role permission safety without requiring a database:

```bash
npm run test -- --testPathPattern="seed.spec"
```

### What is tested

| Test group | What it verifies |
|---|---|
| `Seed Registry` — seeder names | No duplicate seeder names |
| `Seed Registry` — dependency order | permissions < roles < users order |
| `Seed Registry` — reset order | getSeedersReversed returns users < roles < permissions |
| `Seed Registry` — reset functions | All seeders have reset functions |
| `Seed Registry` — dependencies declared | Roles depends on permissions, users on roles |
| `parseSeedMode` | Defaults to upsert, handles `--mode=upsert/reset`, case-insensitive, trims whitespace |
| `isResetAllowed` | False when unset, false for `'false'` string, true only for `'true'` |
| `Seed Logger sanitization` | Password, token, hash, secret, credential, otp fields are redacted (case-insensitive) |
| `Role permission safety` | `seedRoles` does NOT call `deleteMany`; `resetRoles` DOES call `deleteMany` (verified via code inspection) |
| `Admin password resolution` | SEED_ADMIN_PASSWORD env var respected; production requires it, dev does not |
| `seed.helpers exports` | Both functions are callable without side effects |

> Note: Seed runner integration (actual upsert/reset with a database) requires a running PostgreSQL instance and is tested manually via `npm run db:seed` and `ALLOW_SEED_RESET=true npm run db:seed:reset`.
