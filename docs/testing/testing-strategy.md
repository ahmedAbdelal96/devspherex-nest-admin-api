# Testing Strategy

**Date:** 2026-06-10
**Phase:** 5

---

## Overview

This project uses **Jest** for unit testing. The goal is to provide a meaningful test foundation that covers security-sensitive business logic without requiring a live database or external providers.

---

## Where Tests Live

Tests are placed next to the files they test, following the NestJS convention:

```
src/
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

- **No integration tests** — require a real PostgreSQL instance
- **No controller/http tests** — would require `INestApplication` setup
- **No EMAIL/WHATSAPP/SMS provider tests** — channels are not implemented
- **Smoke test** requires port 3105 to be free
- **Quality gate** does not include smoke test (DB-dependent)

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
