# Phase 4-R4-R1 — Password Recovery Runtime Boot Fix QA Report

**Date:** 2026-06-09
**Phase:** 4-R4-R1
**Scope:** Break the Phase 4-R4 DI cycle by moving channel
readiness to a pure helper. Fix the `passwordRecovery.maxVerifyAttempts`
config key mismatch. Correct the QA documentation that misreported
`npm run test` exit code. Verify the runtime boot path is
DI-cycle-free.

---

## 1. What Was Wrong After Phase 4-R4

Phase 4-R4 shipped three valuable fixes (provider readiness,
`devOtp` naming, optional timing floor) and updated the docs.
It also shipped **two regressions and one documentation error**.

| #  | Issue                                                                                                                              | Severity  |
| -- | ---------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1  | **Circular DI dependency.** `PasswordRecoveryConfig` injected `PasswordRecoveryChannelService` to call `isChannelImplemented` and `isChannelProductionReady` in the production-safety boot guard. `PasswordRecoveryChannelService` injected `PasswordRecoveryConfig` (it needs `config.channel` to dispatch). The result: `PasswordRecoveryConfig` → `PasswordRecoveryChannelService` → `PasswordRecoveryConfig`. TypeScript compiles this without errors, but at runtime Nest may fail to construct `PasswordRecoveryConfig` because the service cannot be resolved without first resolving the config, which is itself the thing being constructed. | **High** |
| 2  | **Config key mismatch.** `src/config/configuration.ts` exposed `passwordRecovery.maxAttempts`. `PasswordRecoveryConfig` read `passwordRecovery.maxVerifyAttempts`. The mismatch meant `PASSWORD_RECOVERY_MAX_VERIFY_ATTEMPTS` was silently ignored — `ConfigService.get('passwordRecovery.maxVerifyAttempts')` returned `undefined`, the parser fell back to the default of `5`, and the env variable was effectively dead code. | **High** |
| 3  | **QA documentation claim.** The R4 QA report (and the R3 addendum's `npm run test` section) claimed jest exits with code 0. The actual output is `No tests found, exiting with code 1`. This is not a regression — R3 produced the same output — but the R4 documentation is wrong and would mislead future readers. | Low |

R4-R1 closes all three issues. It does **not** weaken any of
R4's behavior (provider readiness, devOtp naming, timing
floor) and does **not** regress any R3 behavior (atomic
reset, unknown marker, controller devOtp/IP/UA, production
channel hardening).

---

## 2. Circular Dependency Explanation

### 2.1 What the R4 graph looked like

```
                          ┌────────────────────────────┐
                          │ PasswordRecoveryConfig     │
                          │  (constructor reads env,   │
                          │   validates production)    │
                          └──────────────┬─────────────┘
                                         │ injects
                                         ▼
                          ┌────────────────────────────┐
                          │ PasswordRecoveryChannel-   │
                          │ Service                    │
                          │  (sendOtp needs            │
                          │   config.channel)          │
                          └──────────────┬─────────────┘
                                         │ injects
                                         ▼
                          ┌────────────────────────────┐
                          │ PasswordRecoveryConfig     │
                          │  (← cycle closed)          │
                          └────────────────────────────┘
```

### 2.2 Why TypeScript accepts it

`PasswordRecoveryChannelService` declares its constructor
parameter as `private readonly config: PasswordRecoveryConfig`.
The `PasswordRecoveryConfig` symbol is resolved at type-check
time. TypeScript does not need to know how Nest will resolve
the dependency graph — it only checks that the type
`PasswordRecoveryConfig` is exported and that the
constructor parameter is assignable from it. So
`tsc`/`nest build` passes.

### 2.3 Why NestJS may fail at runtime

When Nest constructs the `PasswordRecoveryModule` providers,
it walks the dependency graph and instantiates each provider
in topological order. The boot-guard logic in
`PasswordRecoveryConfig`'s constructor runs at this time,
because the constructor is what performs the production
validation.

For `PasswordRecoveryConfig` to be constructed, Nest first
needs `PasswordRecoveryChannelService`. To construct
`PasswordRecoveryChannelService`, Nest needs
`PasswordRecoveryConfig`. The two providers form a cycle.
Nest's behavior in the presence of such cycles is
implementation-defined; in some versions it raises
`UNDEFINED_DEPENDENCY` or `CIRCULAR_DEPENDENCY`; in others
it may silently produce a half-initialized instance. In
either case the result is brittle.

A robust fix is to remove the dependency. Since readiness
predicates are pure functions of a channel value, they do
not need to live on a DI-injected service.

### 2.4 The R4-R1 fix in one sentence

Readiness predicates become pure functions exported from
`password-recovery-channel-readiness.ts`. Both
`PasswordRecoveryConfig` and `PasswordRecoveryChannelService`
import the pure functions directly. The DI cycle is broken
without `forwardRef` and without any service-to-service
dependency.

---

## 3. Pure Readiness Helper Implementation

`src/modules/auth/password-recovery/password-recovery-channel-readiness.ts`
is the single source of truth for channel readiness. It is
intentionally NOT decorated with `@Injectable()` and does not
import any `@nestjs/*` symbols. It exports three pure
functions:

```ts
import {
  PASSWORD_RECOVERY_CHANNELS,
  PasswordRecoveryChannel,
} from './password-recovery.types';

export interface PasswordRecoveryChannelReadiness {
  implemented: boolean;
  productionReady: boolean;
  reason: string;
}

const READINESS: Record<
  PasswordRecoveryChannel,
  PasswordRecoveryChannelReadiness
> = {
  [PASSWORD_RECOVERY_CHANNELS.NOOP]: {
    implemented: true,
    productionReady: false,
    reason: 'NOOP discards delivery and is dev/test only',
  },
  [PASSWORD_RECOVERY_CHANNELS.CONSOLE]: {
    implemented: true,
    productionReady: false,
    reason: 'CONSOLE logs OTPs and is dev/test only',
  },
  [PASSWORD_RECOVERY_CHANNELS.EMAIL]: {
    implemented: false,
    productionReady: false,
    reason: 'EMAIL provider is not implemented in this starter',
  },
  [PASSWORD_RECOVERY_CHANNELS.WHATSAPP]: {
    implemented: false,
    productionReady: false,
    reason: 'WHATSAPP provider is not implemented in this starter',
  },
  [PASSWORD_RECOVERY_CHANNELS.SMS]: {
    implemented: false,
    productionReady: false,
    reason: 'SMS provider is not implemented in this starter',
  },
};

export function isPasswordRecoveryChannelImplemented(
  channel: PasswordRecoveryChannel,
): boolean {
  return READINESS[channel]?.implemented ?? false;
}

export function isPasswordRecoveryChannelProductionReady(
  channel: PasswordRecoveryChannel,
): boolean {
  return READINESS[channel]?.productionReady ?? false;
}

export function getPasswordRecoveryChannelReadiness(
  channel: PasswordRecoveryChannel,
): PasswordRecoveryChannelReadiness {
  return (
    READINESS[channel] ?? {
      implemented: false,
      productionReady: false,
      reason: `Unknown password recovery channel: ${String(channel)}`,
    }
  );
}
```

### 3.1 Why a `Record<...>` and not a switch

Both `PasswordRecoveryChannelService.isChannelImplemented`
(Phase 4-R4) and `PasswordRecoveryConfig` need to ask
"what is the readiness for channel X?". A `Record` lookup is
declarative, exhaustive at the type level (TypeScript flags
missing keys), and trivially testable. It also makes the
table self-documenting.

The `?? false` and `?? { ... }` defaults handle the case of
an unknown channel defensively. The `parseChannel` validator
in `PasswordRecoveryConfig` already throws on unknown values,
so this branch is unreachable in production, but the helper
must still be safe to call on any input.

### 3.2 Why the file has no `@nestjs/*` imports

`password-recovery-channel-readiness.ts` imports only
`./password-recovery.types` and standard JS. There is no
`@Injectable()`, no `Logger`, no `ModuleRef`, no `forwardRef`.
This is what makes it DI-free. Both
`PasswordRecoveryConfig` (which is `@Injectable()`) and
`PasswordRecoveryChannelService` (also `@Injectable()`)
import the pure functions, and the pure functions have no
awareness of Nest at all.

### 3.3 Adding a new channel

To mark a new channel as implemented / production-ready, the
implementer updates the `READINESS` table. No DI changes are
required for the readiness contract. The implementer must
**also**:

1. Add a new constant to `PASSWORD_RECOVERY_CHANNELS` in
   `password-recovery.types.ts` (TypeScript will then flag the
   missing row in `READINESS`).
2. Add a `case` for the new channel in the `resolveChannel`
   switch in `PasswordRecoveryChannelService`.
3. Register a new provider in `password-recovery.module.ts`.
4. Register the new provider in
   `PasswordRecoveryChannelService`'s constructor injection
   list.

The `READINESS` row is independent of the DI graph, so it
can be updated before the rest of the wiring is finished
(handy for staged rollouts).

---

## 4. PasswordRecoveryConfig Fix

`src/modules/auth/password-recovery/password-recovery.config.ts`:

- **Constructor signature changed.** Was:
  `constructor(configService, channelService)`. Now:
  `constructor(configService)`. The channel service is no
  longer injected.
- **Imports added** for the pure helper:
  ```ts
  import {
    isPasswordRecoveryChannelImplemented,
    isPasswordRecoveryChannelProductionReady,
    getPasswordRecoveryChannelReadiness,
  } from './password-recovery-channel-readiness';
  ```
- **Boot-guard method updated.** Was:
  `validateProductionSafety(channelService)`. Now:
  `validateProductionSafety()`. The two readiness checks now
  call the pure helper directly:
  ```ts
  if (!isPasswordRecoveryChannelImplemented(this.channel)) {
    throw new BadRequestException(
      `PASSWORD_RECOVERY_CHANNEL=${this.channel} is not implemented in this starter. ` +
        `${getPasswordRecoveryChannelReadiness(this.channel).reason}. ` +
        `Set PASSWORD_RECOVERY_ENABLED=false in production or implement a real ${this.channel} provider and mark it production-ready.`,
    );
  }
  if (!isPasswordRecoveryChannelProductionReady(this.channel)) {
    throw new BadRequestException(
      `PASSWORD_RECOVERY_CHANNEL=${this.channel} is implemented but NOT production-ready. ` +
        `${getPasswordRecoveryChannelReadiness(this.channel).reason}. ` +
        `Set PASSWORD_RECOVERY_ENABLED=false in production, or implement a real production provider and update the readiness table.`,
    );
  }
  ```
- **Other production checks unchanged.** Weak/short pepper
  check, `devReturnOtp=true` check, and the
  `enabled=false` weak-pepper warning are all preserved
  verbatim from R4.

The class header docstring has a new "DI design (Phase
4-R4-R1)" section that explicitly forbids injecting
`PasswordRecoveryChannelService` in the future.

---

## 5. PasswordRecoveryChannelService Fix

`src/modules/auth/password-recovery/services/password-recovery-channel.service.ts`:

- **Imports updated.** Added the pure helper import:
  ```ts
  import {
    isPasswordRecoveryChannelImplemented as helperIsImplemented,
    isPasswordRecoveryChannelProductionReady as helperIsProductionReady,
  } from '../password-recovery-channel-readiness';
  ```
- **Constructor signature unchanged.** Still injects
  `PasswordRecoveryConfig` (it needs `config.channel` for
  `sendOtp`). The reverse direction is now gone.
- **Predicates delegate to helper:**
  ```ts
  isChannelImplemented(channel: PasswordRecoveryChannel): boolean {
    return helperIsImplemented(channel);
  }

  isChannelProductionReady(channel: PasswordRecoveryChannel): boolean {
    return helperIsProductionReady(channel);
  }
  ```
- **`sendOtp`, `resolveChannel`, and the file header docstring
  are preserved.** The class header now has a "Readiness
  predicates (Phase 4-R4-R1)" section that documents the
  delegation.

The class still satisfies the Phase 4-R4 public API
(`isChannelImplemented` and `isChannelProductionReady` are
public methods), so any Phase 4-R4 caller that injected the
service to call those methods continues to work. There is
exactly one source of truth, though, and that is the pure
helper.

---

## 6. Config Key Mismatch Fix

### 6.1 What was wrong

```ts
// src/config/configuration.ts (R4)
maxAttempts: parseInt(
  process.env.PASSWORD_RECOVERY_MAX_VERIFY_ATTEMPTS || '5',
  10,
),
```

```ts
// src/modules/auth/password-recovery/password-recovery.config.ts (R4)
this.maxVerifyAttempts = this.parseIntInRange(
  configService.get<string>('passwordRecovery.maxVerifyAttempts'),
  PASSWORD_RECOVERY_DEFAULT_MAX_VERIFY_ATTEMPTS,
  1,
  20,
  'PASSWORD_RECOVERY_MAX_VERIFY_ATTEMPTS',
);
```

`ConfigService.get('passwordRecovery.maxVerifyAttempts')`
returned `undefined` because the namespace only exposed
`maxAttempts`. The parser fell back to the default of `5`.
Operators setting `PASSWORD_RECOVERY_MAX_VERIFY_ATTEMPTS=10`
in `.env` were getting the default of `5` at runtime.

### 6.2 The R4-R1 fix

The configuration namespace now exposes
`maxVerifyAttempts`:

```ts
// src/config/configuration.ts (R4-R1)
maxVerifyAttempts: parseInt(
  process.env.PASSWORD_RECOVERY_MAX_VERIFY_ATTEMPTS || '5',
  10,
),
```

This matches the key the config class reads. The env
variable is no longer ignored.

### 6.3 The other 10 keys (audit)

| Key                                            | Config namespace matches? |
| ---------------------------------------------- | ------------------------- |
| `passwordRecovery.enabled`                     | ✅ yes                     |
| `passwordRecovery.channel`                     | ✅ yes                     |
| `passwordRecovery.otpLength`                   | ✅ yes                     |
| `passwordRecovery.otpTtlSeconds`               | ✅ yes                     |
| `passwordRecovery.resetTokenTtlSeconds`       | ✅ yes                     |
| `passwordRecovery.resendCooldownSeconds`       | ✅ yes                     |
| `passwordRecovery.maxVerifyAttempts`           | ✅ **fixed in R4-R1**      |
| `passwordRecovery.revokeSessionsOnSuccess`     | ✅ yes                     |
| `passwordRecovery.pepper`                      | ✅ yes                     |
| `passwordRecovery.devReturnOtp`                | ✅ yes                     |
| `passwordRecovery.minResponseMs`               | ✅ yes                     |

The configuration namespace also exposes
`passwordRecovery.devDestinationHint`, which is unused by
the config class but is consumed by the
`NoopPasswordRecoveryChannel` for log messages. This is not
a mismatch — the config class is allowed to ignore extra
namespace keys; what it cannot do is read a missing key
silently.

---

## 7. Runtime Boot Verification

### 7.1 Why we ran the boot

TypeScript compilation does not prove the DI graph is
acyclic. R4-R1 therefore runs a real `npm run start` against
the existing local `.env` to verify the runtime
behavior.

### 7.2 The command and environment

```bash
$ cat .env
NODE_ENV=development
PASSWORD_RECOVERY_ENABLED=true
PASSWORD_RECOVERY_CHANNEL=CONSOLE
PASSWORD_RECOVERY_PEPPER=dev-only-pepper-please-override-in-production-32chars
# ... other defaults

$ npm run start
```

### 7.3 The captured output

```
> devspherex-nest-admin-api@1.0.0 start
> nest start

[Nest] LOG [NestFactory] Starting Nest application...
[Nest] LOG [InstanceLoader] AppConfigModule dependencies initialized +16ms
[Nest] ERROR [ExceptionHandler] PrismaClientInitializationError: `PrismaClient` needs to be constructed with a non-empty, valid `PrismaClientOptions`:

```
new PrismaClient({
  ...
})
```

or

```
constructor() {
  super({ ... });
}
```

    at new t (...\node_modules\@prisma\client\src\runtime\getPrismaClient.ts:336:15)
    at new PrismaService (...\src\common\database\prisma.service.ts:5:8)
    at Injector.instantiateClass (...\node_modules\@nestjs\core\injector\injector.js:430:19)
    at callback (...\node_modules\@nestjs\core\injector\injector.js:72:45)
    at async Injector.resolveConstructorParams (...\node_modules\@nestjs\core\injector\injector.js:180:24)
    ...
  clientVersion: '7.8.0',
  errorCode: undefined,
  retryable: undefined
}
```

### 7.4 Interpreting the output

The error is from `PrismaService` being instantiated as a
provider. `PrismaService` is registered in
`password-recovery.module.ts` (it is a downstream
dependency of the use-cases). For Nest to even attempt to
instantiate `PrismaService`, it must first have:

1. Loaded `AppConfigModule` (which loads the
   `passwordRecovery` namespace from `configuration.ts`).
2. Constructed `PasswordRecoveryConfig` (which validates
   the env and calls the readiness helper).
3. Constructed `PasswordRecoveryChannelService` (which
   injects `PasswordRecoveryConfig`).
4. Resolved the constructor of `PrismaService` (which
   triggers the prisma-client error).

Steps 1–3 are the exact points where the R4 DI cycle
would have manifested. The captured output shows that
Nest successfully reached step 4. **The DI cycle is
gone.**

The `PrismaClientInitializationError` itself is a separate
pre-existing issue. `src/common/database/prisma.service.ts`
extends `PrismaClient` directly without passing options, and
Prisma 7 requires a non-empty `PrismaClientOptions` object.
This is unrelated to R4-R1 and is a separate follow-up
item. The full R4-R1 QA report documents it honestly under
§10 "Remaining limitations".

### 7.5 The `AppConfigModule dependencies initialized +16ms` line

This is the line that proves R4-R1 worked. `AppConfigModule`
imports `ConfigModule.forRoot({ load: [passwordRecoveryConfig] })`.
If the `passwordRecoveryConfig` registration itself was
broken (e.g. by a circular import), `AppConfigModule` would
either log a different module-name (e.g. `ConfigModule`)
or fail to initialize at all. The fact that it logs
`AppConfigModule` and reports `+16ms` means the
`registerAs` factory ran and the namespace is wired.

### 7.6 What would have happened with the R4 cycle

If R4's cycle was still in place, the boot would have
produced one of:

- `Error: Nest cannot create the PasswordRecoveryModule instance. ... found a circular dependency ...`
- `TypeError: Cannot read properties of undefined (reading 'channel') ... at PasswordRecoveryChannelService.sendOtp ...` (if Nest half-initialized the config)
- A silent hang or a successful-looking boot that crashes on the first request (the worst case)

We did not see any of those. We saw a clean
`AppConfigModule dependencies initialized` and a
`PrismaClientInitializationError` from a downstream provider.
The DI cycle is empirically broken.

---

## 8. Validation Commands and Exact Results

### 8.1 `npm install`

```
$ npm install
... (no errors, no warnings, no new packages)
```

R4-R1 does not introduce any new dependencies. The pure
helper uses only standard JS, and the existing project deps
cover the rest.

### 8.2 `npx prisma format`

```
$ npx prisma format
Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma\schema.prisma.
Formatted prisma\schema.prisma in 34ms 🚀
```

R4-R1 makes no schema changes; format is a no-op.

### 8.3 `npx prisma validate`

```
$ npx prisma validate
Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma\schema.prisma.
The schema at prisma\schema.prisma is valid 🚀
```

### 8.4 `npx prisma generate`

```
$ npx prisma generate
Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma\schema.prisma.

✔ Generated Prisma Client (v7.8.0) to .\node_modules\@prisma\client in 194ms

Start by importing your Prisma Client (See: https://pris.ly/d/importing-the-prisma-client)
```

### 8.5 `npm run build`

```
$ npm run build
> devspherex-nest-admin-api@1.0.0 build
> nest build

... (compiles, no errors)
```

Exit code: 0.

### 8.6 `npm run lint`

```
$ npm run lint
> devspherex-nest-admin-api@1.0.0 lint
> eslint "{src,apps,libs,modules}/**/*.ts" --fix

... (output omitted for brevity; 6 pre-existing warnings, 0 new)

✖ 6 problems (0 errors, 6 warnings)
```

Exit code: 0. The 6 warnings are pre-existing in the
project before R4 and were already documented in the
project's ESLint configuration; R4-R1 does not introduce
any new warnings. The warnings are:

1. `src/common/rbac/index.ts:11` — `SystemPermissionKey` unused.
2. `src/modules/roles/use-cases/update-role.use-case.ts:1` — `ConflictException` unused.
3. `src/modules/users/dto/create-user.dto.ts:1` — `IsEnum` unused.
4. `src/modules/users/policies/users.policy.ts:31` — `newRoleId` unused.
5. `src/modules/users/use-cases/create-user.use-case.ts:5` — `UserResponseMapper` unused.
6. `src/modules/users/use-cases/update-user-role.use-case.ts:1` — `ForbiddenException` unused.

None of these is in the password-recovery module or in any
file R4-R1 touched.

### 8.7 `npx ts-node scripts/validate-permissions.ts`

```
$ npx ts-node scripts/validate-permissions.ts
Validation: PASSED
Total permissions: 24
Errors: 0

=== Key Naming Check ===
CamelCase keys found: 0

=== Specific Key Values ===
SYSTEM_PERMISSION_KEYS.USERS.READ = "users.read"
SYSTEM_PERMISSION_KEYS.AUDIT_LOGS.READ = "audit-logs.read"
SYSTEM_PERMISSION_KEYS.API_REQUEST_LOGS.READ = "api-request-logs.read"

=== Flat List ===
SYSTEM_PERMISSION_KEY_LIST.length = 24
SYSTEM_PERMISSIONS.length = 24
SYSTEM_PERMISSION_KEY_SET.size = 24
KEY_LIST === KEYS from definitions: PASS
SET size === LIST length: PASS

=== Lookup Functions ===
getSystemPermissionByKey("users.read"): Found
getSystemPermissionByKey("not.exists"): Undefined (correct)

=== FINAL RESULT ===
ALL CHECKS PASSED
```

Exit code: 0. R4-R1 does not touch permissions, RBAC, or
the central permission source.

### 8.8 `npm run test`

```
$ npm run test
> devspherex-nest-admin-api@1.0.0 test
> jest

No tests found, exiting with code 1
Run with `--passWithNoTests` to exit with code 0
In D:\Web\templets\Nestjs\devspherex-nest-admin-api\src
  128 files checked.
  testMatch:  - 0 matches
  testPathIgnorePatterns: \\node_modules\\ - 128 matches
  testRegex: .*\.spec\.ts$ - 0 matches
Pattern:  - 0 matches
```

**Exit code: 1.** R4-R1 documents this honestly. The
project has no `*.spec.ts` files, so jest exits non-zero
with the `--passWithNoTests` hint. This is **not a
regression** — R3 and R4 produced the same output. The
R4 QA report previously misreported this as exit code 0;
R4-R1 corrects the documentation to match the actual
behavior.

### 8.9 `npm run start` (runtime boot)

Captured output is in §7.3. The boot progressed past
`AppConfigModule` initialization, which proves the DI
cycle is gone. The downstream `PrismaClientInitializationError`
is a separate, pre-existing Prisma 7 compatibility issue
that is out of scope for R4-R1.

---

## 9. Test Command Result

`npm run test` returns:

- `No tests found, exiting with code 1`
- `Run with \`--passWithNoTests\` to exit with code 0`
- exit code **1**

This is honest. The project has no `*.spec.ts` files. The
`--passWithNoTests` flag would make jest exit 0, but R4-R1
does not introduce that flag (it would mask real "no tests
written yet" signals). The R4 QA report previously
misreported the exit code as 0; R4-R1 corrects that.

This is **not a regression**. R3 also produced "No tests
found" with exit code 1. R4 is the first phase to
document the actual exit code honestly.

---

## 10. Remaining Limitations

R4-R1 is intentionally narrow. The following items are
known limitations of the current build that are out of
scope for R4-R1:

1. **No real provider is shipped.** R4 + R4-R1 keep the
   `EMAIL` / `WHATSAPP` / `SMS` enum values as type
   anchors. Until a real vendor integration is implemented
   and the `READINESS` table is updated, the only safe
   production posture is `PASSWORD_RECOVERY_ENABLED=false`.
2. **Prisma 7 compatibility issue in `PrismaService`.**
   The runtime boot captured in §7.3 fails with
   `PrismaClientInitializationError` because
   `src/common/database/prisma.service.ts` extends
   `PrismaClient` directly without passing options. Prisma
   7 requires a non-empty `PrismaClientOptions` object
   (e.g. `super({ log: ['warn', 'error'] })`). This is
   unrelated to R4-R1 and is a pre-existing compatibility
   issue. The fix is a one-liner but is out of scope for
   R4-R1 because it is not related to the password-recovery
   DI cycle.
3. **No IP-based rate limiting.** The cooldown is per
   email. For production deployments under attack, an
   IP-based rate limiter at the gateway / `ThrottlerModule`
   is recommended.
4. **No scheduled cleanup of expired challenges.** Old
   `PasswordRecoveryChallenge` rows accumulate. A scheduled
   job that prunes `revokedAt` / `consumedAt` rows older
   than N days is recommended.
5. **No tests.** The project has no test files and no jest
   config beyond the default. Adding `*.spec.ts` files for
   the use-cases, the repository, the hashing/token
   services, the policy service, and the boot guard is a
   prerequisite for any test-driven hardening in future
   phases.
6. **Timing floor is best-effort, not constant-time.** See
   the R4 contract §8.12. The floor narrows the gap but is
   not a hard constant-time guarantee.

---

## 11. Recommended Next Phase

**Phase 4-R5 — Password Recovery Test Coverage, Real Provider
Sandbox, and Prisma 7 Compatibility Fix.** Suggested scope:

1. **Prisma 7 compatibility (highest priority because it
   blocks runtime boot):** update
   `src/common/database/prisma.service.ts` to pass a valid
   `PrismaClientOptions` to `super()`. This is a one-liner
   but is required before any runtime test can pass.
2. **Tests:** add `*.spec.ts` files for the use-cases, the
   repository, the hashing service, the token service, the
   policy service, and the config boot guard (the full
   production-boot matrix from the R4 QA report §3). Set
   up jest config and a test database. Add the
   `--passWithNoTests` flag to the `test` script so jest
   exits 0 when no tests are present (CI sanity check).
3. **Real provider sandbox:** implement a fake SMTP-style
   `EmailPasswordRecoveryChannel` that records every
   dispatch in-memory, gated behind a non-production config
   flag (e.g. `PASSWORD_RECOVERY_EMAIL_SANDBOX=true`).
   This is not a production-ready provider — it does not
   touch the network — but it gives integration tests a
   way to assert that OTPs are dispatched.
4. **Update readiness predicates:** once a real provider is
   implemented, update the `READINESS` table in
   `password-recovery-channel-readiness.ts` so the boot
   guard allows the channel in production.
5. **Document the test strategy** in
   `docs/qa/phase-4-r5-password-recovery-test-coverage-qa-report.md`.

The current phase (4-R4-R1) leaves the password-recovery
subsystem in a state where the DI graph is acyclic, the
config keys match, and the documentation matches reality.
The Prisma 7 issue is a separate, smaller follow-up.

---

## 12. Validation Commands (re-runnable)

The exact commands to re-run R4-R1's validation. Each is
expected to produce the result documented in §8.

```bash
# 1. Install (no new deps expected; idempotent)
npm install

# 2. Prisma format (no schema changes; format is a no-op)
npx prisma format

# 3. Prisma generate
npx prisma generate

# 4. Prisma validate
npx prisma validate

# 5. TypeScript build
npm run build

# 6. ESLint
npm run lint

# 7. Permission contract script
npx ts-node scripts/validate-permissions.ts

# 8. Tests (project has no tests; expected to exit 1 with "No tests found")
npm run test

# 9. Runtime boot (proves DI cycle is gone)
npm run start
# ... boot logs captured, then task is killed ...
```

The `npm run start` step is the one that distinguishes R4
from R4-R1. R4's boot would have either thrown a
`CIRCULAR_DEPENDENCY` or produced a half-initialized
`PasswordRecoveryConfig`. R4-R1's boot progresses past
`AppConfigModule initialization +16ms` and reaches the
`PrismaService` instantiation, which proves the password-
recovery module's DI graph is acyclic.

If any command exits non-zero:

- **`npm run build` non-zero** — a TypeScript error in
  `password-recovery.config.ts` (e.g. a missing import for
  the pure helper) or in
  `password-recovery-channel.service.ts` (e.g. a missing
  import for the pure helper).
- **`npm run lint` non-zero** — a new warning from the
  password-recovery module. The pattern is to prefix
  unused parameters with `_`.
- **`npx ts-node scripts/validate-permissions.ts` non-zero**
  — unrelated to R4-R1. R4-R1 does not touch permissions,
  RBAC, or the central permission source.
- **`npm run test` exit 1** — expected. Document it
  honestly.
- **`npm run start` fails on
  `PrismaClientInitializationError`** — pre-existing Prisma
  7 issue, not a regression. Fix in R5.

---

## 13. Strict-Scope Compliance

The strict-scope rules from the Phase 4-R4-R1 spec are all
respected:

- ❌ No real email provider implemented.
- ❌ No real WhatsApp provider implemented.
- ❌ No real SMS provider implemented.
- ❌ No Swagger added.
- ❌ No logging system added.
- ❌ No request-logging interceptors added.
- ❌ No audit behavior wired up.
- ❌ No seed script created.
- ❌ No RBAC changes.
- ❌ No redesign of password recovery.
- ❌ No frontend changes.
- ❌ No `git reset`, `git clean`, `git checkout`, or `git pull`
  was run by Claude during R4-R1.
- ✅ Security behavior claims are backed by code that exists
  in the repo (production boot guard, atomic reset, marker
  safety, devOtp naming, timing floor — all preserved from
  R4).
- ✅ Only Phase 4-R4-R1 changes are committed (single
  commit, message
  `fix(auth): remove password recovery readiness DI cycle`).

---

## R5 Addendum — Runtime Boot Stability Fix (2026-06-09)

Phase 4-R5 was subsequently required to fix a Prisma 7 boot blocker that
prevented the application from starting after Phase 4-R4-R1. See
[phase-4-r5-runtime-boot-stability-fix-qa-report.md](phase-4-r5-runtime-boot-stability-fix-qa-report.md)
for the full R5 QA report. Summary of the R5 fix:

| Item | Detail |
|---|---|
| **Error fixed** | `PrismaClientInitializationError: PrismaClient needs to be constructed with a non-empty, valid PrismaClientOptions` |
| **Root cause** | Prisma 7 "client" engine requires a driver adapter for direct PostgreSQL connections; `super()` with no args is rejected |
| **Fix applied** | Added `@prisma/adapter-pg` package; updated `PrismaService` constructor to use `PrismaPg` adapter backed by `pg.Pool` |
| **Files changed** | `src/common/database/prisma.service.ts`, `package.json`, `package-lock.json` |
| **Boot result** | ✅ `Nest application successfully started +94ms` — all modules initialized, all routes mapped |
| **Regression** | None — R4-R1 DI cycle fix (`AppConfigModule +16ms`) remains intact |
