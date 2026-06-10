# Testing Strategy

**Date:** 2026-06-10
**Phase:** 7-A-R1

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
  test-utils/
    mocks.ts                                     ← shared mock factories
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
