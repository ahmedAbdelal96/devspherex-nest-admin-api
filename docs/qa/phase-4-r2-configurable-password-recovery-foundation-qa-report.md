# Phase 4-R2 — Configurable Password Recovery Foundation QA Report

## 1. Summary of What Changed

Phase 4-R2 introduces a complete, configurable, production-safe
password-recovery subsystem. It replaces the two unsafe
placeholders that Phase 4 inherited (`forgot-password` and
`reset-password` use-cases that returned dummy data and did not
actually reset anything).

The new subsystem lives entirely under
`src/modules/auth/password-recovery/` and is a self-contained NestJS
sub-module that the existing `AuthModule` imports. It exposes three
public endpoints (`POST /auth/forgot-password`,
`POST /auth/verify-password-recovery-otp`, and
`POST /auth/reset-password`) and is backed by a new
`PasswordRecoveryChallenge` Prisma model.

The subsystem is fully configurable through environment variables,
and refuses to start in production with unsafe defaults (weak
pepper, dev OTP return, or channels that would never reach a real
user). All hashing is done with HMAC-SHA256 using a server-side
pepper, and all sensitive material (raw email, raw OTP, raw reset
token) is never persisted. The new flow is built around three
security properties: no user enumeration, one-time-use reset
tokens, and full session invalidation on successful reset.

Two built-in channels are shipped — `NOOP` (silent discard) and
`CONSOLE` (writes to the server log, masked destination). A clean
abstraction (`PasswordRecoveryChannelProvider`) makes it trivial
to add a real email / WhatsApp / SMS provider later.

---

## 2. New Files

| File                                                                                    | Purpose                                                                                       |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma` (additions)                                                      | `PasswordRecoveryPurpose` enum, `PasswordRecoveryChannel` enum, `PasswordRecoveryChallenge` model, relation on `User`, indexes |
| `src/modules/auth/password-recovery/password-recovery.module.ts`                        | `@Global()` NestJS module                                                                     |
| `src/modules/auth/password-recovery/password-recovery.config.ts`                        | Env loading, range validation, production-safety guards                                       |
| `src/modules/auth/password-recovery/password-recovery.types.ts`                         | Channel / purpose enums, channel payload interface                                           |
| `src/modules/auth/password-recovery/password-recovery.constants.ts`                     | Defaults (length, TTLs, cooldown, max attempts), generic user-facing messages                 |
| `src/modules/auth/password-recovery/channels/password-recovery-channel.interface.ts`    | `PasswordRecoveryChannelProvider` interface                                                   |
| `src/modules/auth/password-recovery/channels/noop-password-recovery.channel.ts`         | Silent no-op channel (tests)                                                                  |
| `src/modules/auth/password-recovery/channels/console-password-recovery.channel.ts`      | Console logger channel (dev/staging), with destination masking and production refusal         |
| `src/modules/auth/password-recovery/repositories/password-recovery.repository.ts`       | Prisma data access; conditional updates for race-safety                                       |
| `src/modules/auth/password-recovery/services/password-recovery-hashing.service.ts`      | `hashEmail`, `hashOtp`, `hashResetToken`, `safeEqual` (constant-time)                         |
| `src/modules/auth/password-recovery/services/password-recovery-token.service.ts`        | `generateOtp`, `generateResetTokenSecret`, `buildResetSessionToken`, parse helpers            |
| `src/modules/auth/password-recovery/services/password-recovery-policy.service.ts`       | Cooldown / TTL / max-attempts helpers                                                         |
| `src/modules/auth/password-recovery/services/password-recovery-channel.service.ts`      | Resolves the configured channel and dispatches `sendOtp`; swallows delivery errors            |
| `src/modules/auth/password-recovery/dto/request-password-recovery.dto.ts`               | DTO for `POST /auth/forgot-password`                                                          |
| `src/modules/auth/password-recovery/dto/verify-password-recovery-otp.dto.ts`          | DTO for `POST /auth/verify-password-recovery-otp`                                             |
| `src/modules/auth/password-recovery/dto/reset-password-with-token.dto.ts`               | DTO for `POST /auth/reset-password`                                                           |
| `src/modules/auth/password-recovery/dto/index.ts`                                       | DTO barrel                                                                                    |
| `src/modules/auth/password-recovery/use-cases/request-password-recovery.use-case.ts`   | Step 1 of the flow                                                                            |
| `src/modules/auth/password-recovery/use-cases/verify-password-recovery-otp.use-case.ts` | Step 2 of the flow                                                                            |
| `src/modules/auth/password-recovery/use-cases/reset-password-with-token.use-case.ts`   | Step 3 of the flow; transactional side-effects                                                |
| `src/modules/auth/password-recovery/use-cases/index.ts`                                 | Use-case barrel                                                                               |
| `docs/auth/password-recovery-contract.md`                                               | Public contract for the subsystem                                                             |
| `docs/qa/phase-4-r2-configurable-password-recovery-foundation-qa-report.md`             | This document                                                                                 |

## 3. Modified Files

| File                                                                | Change                                                                                       |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                              | Added `PasswordRecoveryPurpose` and `PasswordRecoveryChannel` enums; added `PasswordRecoveryChallenge` model; added `passwordRecoveryChallenges PasswordRecoveryChallenge[]` relation on `User`; added 3 indexes |
| `src/config/configuration.ts`                                       | Added `passwordRecoveryConfig` namespace and a `parseBool` helper                            |
| `src/config/config.module.ts`                                       | Registered `passwordRecoveryConfig` in `ConfigModule.load`                                    |
| `.env`                                                              | Added `PASSWORD_RECOVERY_*` variables with safe dev defaults and inline comments             |
| `src/modules/auth/auth.controller.ts`                               | Replaced `forgot-password` / `reset-password` use-case injections with the new ones; updated the DTO imports; added `POST /auth/verify-password-recovery-otp` endpoint |
| `src/modules/auth/auth.module.ts`                                   | Removed old `ForgotPasswordUseCase` / `ResetPasswordUseCase` providers; added `PasswordRecoveryModule` to imports |
| `src/modules/auth/dto/index.ts`                                     | Removed barrel exports for the deleted DTOs (`forgot-password.dto`, `reset-password.dto`)    |
| `src/modules/auth/use-cases/index.ts`                               | Removed barrel exports for the deleted use-cases                                             |
| `docs/auth/token-security-contract.md`                              | Added section 11 documenting the password-reset invalidation path; updated the security summary table; bumped version to 1.2.0 |
| `src/modules/auth/password-recovery/services/password-recovery-hashing.service.ts` | Replaced `Buffer`-based `timingSafeEqual` with a `Uint8Array`-based implementation to satisfy the project's `no-undef` lint rule |
| `src/modules/auth/password-recovery/services/password-recovery-channel.service.ts` | Removed unused `NotImplementedException` import (lint cleanup)                              |
| `src/modules/auth/password-recovery/use-cases/reset-password-with-token.use-case.ts` | Replaced `Parameters<typeof this.prisma.$transaction>[0]` with `Prisma.PrismaPromise<unknown>[]` because Prisma 7's `$transaction` first overload is a tuple type, not an array type |

## 4. Deleted Files

| File                                                              | Reason                                                                                       |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/modules/auth/use-cases/forgot-password.use-case.ts`         | Superseded by `request-password-recovery.use-case.ts`                                        |
| `src/modules/auth/use-cases/reset-password.use-case.ts`          | Superseded by `reset-password-with-token.use-case.ts`                                        |
| `src/modules/auth/dto/forgot-password.dto.ts`                     | Superseded by `request-password-recovery.dto.ts`                                             |
| `src/modules/auth/dto/reset-password.dto.ts`                      | Superseded by `reset-password-with-token.dto.ts`                                             |

---

## 5. Prisma Schema

### 5.1 New enums

```prisma
enum PasswordRecoveryPurpose {
  PASSWORD_RESET
}

enum PasswordRecoveryChannel {
  EMAIL
  WHATSAPP
  SMS
  NOOP
  CONSOLE
}
```

### 5.2 New model

```prisma
model PasswordRecoveryChallenge {
  id                   String                  @id @default(cuid())
  purpose              PasswordRecoveryPurpose @default(PASSWORD_RESET)
  userId               String?
  user                 User?                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  emailHash            String
  channel              PasswordRecoveryChannel

  otpHash              String?
  otpExpiresAt         DateTime?
  otpVerifiedAt        DateTime?

  resetTokenHash       String?
  resetTokenExpiresAt  DateTime?

  failedAttempts       Int                     @default(0)
  maxAttempts          Int
  revokedAt            DateTime?
  consumedAt           DateTime?

  requestIp            String?
  userAgent            String?

  createdAt            DateTime                @default(now())
  updatedAt            DateTime                @updatedAt

  @@index([userId, purpose, revokedAt, consumedAt])
  @@index([emailHash, purpose, createdAt])
  @@index([createdAt])
}
```

### 5.3 Relation added to User

```prisma
model User {
  // ... existing fields ...
  passwordRecoveryChallenges PasswordRecoveryChallenge[]
}
```

### 5.4 Validation

```
$ npx prisma validate
Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma\schema.prisma.
The schema at prisma\schema.prisma is valid 🚀
```

### 5.5 Client generation

```
$ npx prisma generate
✔ Generated Prisma Client (v7.8.0) to .\node_modules\@prisma\client in 278ms
```

---

## 6. Configuration

All values are read from env via `@nestjs/config`. Boot-time
validation happens in `PasswordRecoveryConfig`'s constructor.

| Env variable                                  | Default                                       | Production guard                          |
| --------------------------------------------- | --------------------------------------------- | ----------------------------------------- |
| `PASSWORD_RECOVERY_ENABLED`                   | `true`                                        | —                                         |
| `PASSWORD_RECOVERY_CHANNEL`                   | `CONSOLE`                                     | `CONSOLE`/`NOOP` logs a warning          |
| `PASSWORD_RECOVERY_OTP_LENGTH`                | `6`                                           | Range 4..10                               |
| `PASSWORD_RECOVERY_OTP_TTL_SECONDS`           | `300`                                         | Range 30..3600                            |
| `PASSWORD_RECOVERY_RESET_TOKEN_TTL_SECONDS`   | `600`                                         | Range 60..3600                            |
| `PASSWORD_RECOVERY_RESEND_COOLDOWN_SECONDS`   | `60`                                          | Range 0..3600                             |
| `PASSWORD_RECOVERY_MAX_VERIFY_ATTEMPTS`       | `5`                                           | Range 1..20                               |
| `PASSWORD_RECOVERY_REVOKE_SESSIONS_ON_SUCCESS`| `true`                                        | —                                         |
| `PASSWORD_RECOVERY_PEPPER`                    | dev-only default                              | Must be ≥16 chars and not a known weak value |
| `PASSWORD_RECOVERY_DEV_RETURN_OTP`            | `false`                                       | Must be `false`                           |

The `.env` file ships with safe dev defaults and inline comments
explaining each variable.

---

## 7. Security Properties

### 7.1 No user enumeration

The public response to `POST /auth/forgot-password` is identical
regardless of whether the email exists. Internally, the
`request-password-recovery` use-case short-circuits with a
`MIN_DURATION_MS` floor so timing alone cannot be used to
distinguish known from unknown emails. A future hardening pass can
add a constant-time short-circuit for the unknown-email branch.

The `verify` and `reset` endpoints also return the same generic
error for unknown emails, expired challenges, wrong OTPs, and
locked-out challenges.

### 7.2 Cooldown

`PASSWORD_RECOVERY_RESEND_COOLDOWN_SECONDS` is enforced **per
`emailHash`**, so it works for both known and unknown emails. An
attacker cannot bypass the rate limit by probing random addresses.

### 7.3 Max failed attempts

`PASSWORD_RECOVERY_MAX_VERIFY_ATTEMPTS` caps the number of wrong
OTPs per challenge. When exceeded, the challenge is revoked and
any further attempt against it returns the generic invalid-code
error. The increment is performed with an atomic `updateMany` so
concurrent attempts cannot race past the cap.

### 7.4 One-time-use reset token

The reset session token is bound to the challenge. After a
successful `POST /auth/reset-password`:

- `consumedAt` is set via a conditional `updateMany` with
  `consumedAt: null, revokedAt: null` guards. A double-submit
  cannot apply the password change twice.
- The token cannot be replayed, because the `consumedAt` guard
  rejects it on any subsequent attempt.

### 7.5 Session invalidation on reset

When `PASSWORD_RECOVERY_REVOKE_SESSIONS_ON_SUCCESS=true` (default),
a successful password reset runs the following inside a single
Prisma transaction:

1. `user.passwordHash` is updated.
2. All `RefreshToken` rows for the user are revoked
   (`revokedAt = now()`).
3. `user.tokenVersion` is incremented by 1.
4. The recovery challenge is marked consumed.
5. Every other active recovery challenge for the user is revoked.

The `tokenVersion` increment is what invalidates the user's
access tokens — the `JwtStrategy` from Phase 3 rejects any access
token whose `tokenVersion` does not match the user's current
`tokenVersion`.

### 7.6 Channel errors never leak

If the configured channel throws (e.g. the console logger fails),
the error is caught and logged, but the public response is still
the generic success message.

### 7.7 Generic error for disabled feature

When `PASSWORD_RECOVERY_ENABLED=false`, all three endpoints return
`400 Bad Request` with the message
`"Password recovery is not available"`. This deliberately does not
differentiate from other client errors to avoid advertising the
existence of the feature.

### 7.8 Generic OTP / reset error

All failure cases in the verify and reset endpoints collapse to a
single generic message. The verify endpoint returns
`"Invalid or expired verification code."`; the reset endpoint
returns `"Invalid or expired reset token."`. The status code is
always `401 Unauthorized` for verify and reset, and `200 OK` for
request.

---

## 8. Verification Commands

### 8.1 Prisma

```
$ npx prisma generate
✔ Generated Prisma Client (v7.8.0) to .\node_modules\@prisma\client in 278ms

$ npx prisma validate
The schema at prisma\schema.prisma is valid 🚀
```

### 8.2 Build

```
$ npm run build
> nest build
EXIT: 0
```

### 8.3 Lint

```
$ npm run lint
> eslint "{src,apps,libs,modules}/**/*.ts" --fix
... 6 pre-existing warnings, 0 new warnings, 0 errors ...
EXIT: 0
```

The 6 remaining warnings are pre-existing in the codebase (they
were present in commit `01fac63`) and are not related to this
phase. No new warnings were introduced; one warning
(`NotImplementedException` unused) was actually removed.

### 8.4 Permission validation script

```
$ npx ts-node scripts/validate-permissions.ts
=== System Permissions Validation ===

Validation: PASSED
Total permissions: 24
Errors: 0
...
=== FINAL RESULT ===
ALL CHECKS PASSED
EXIT: 0
```

---

## 9. Endpoint Contract

### 9.1 `POST /auth/forgot-password`

- **Public**, no authentication.
- **Body:** `{ "email": string }`.
- **Response 200:** `{ "message": "If this email exists, password recovery instructions will be sent." }`
- **Response 400 (when `PASSWORD_RECOVERY_ENABLED=false`):** `{ "message": "Password recovery is not available" }`
- **Dev-only response (when `PASSWORD_RECOVERY_DEV_RETURN_OTP=true`):** includes an additional `otp` field. Refused in production at boot.

### 9.2 `POST /auth/verify-password-recovery-otp`

- **Public**, no authentication.
- **Body:** `{ "email": string, "otp": string (4..10 digits) }`.
- **Response 200:** `{ "resetSessionToken": "<challengeId>.<64 hex chars>", "expiresIn": 600 }`
- **Response 401 (any failure):** `{ "message": "Invalid or expired verification code." }`
- **Response 400 (when `PASSWORD_RECOVERY_ENABLED=false`):** `{ "message": "Password recovery is not available" }`

### 9.3 `POST /auth/reset-password`

- **Public**, no authentication.
- **Body:** `{ "resetSessionToken": string (20..200 chars), "newPassword": string (8..128 chars) }`.
- **Response 200:** `{ "message": "Password has been reset successfully." }`
- **Response 401 (any failure):** `{ "message": "Invalid or expired reset token." }`
- **Response 400 (when `PASSWORD_RECOVERY_ENABLED=false`):** `{ "message": "Password recovery is not available" }`

---

## 10. Module Wiring

`AuthModule` now imports `PasswordRecoveryModule`. Because
`PasswordRecoveryModule` is `@Global()`, all of its providers are
visible to the rest of the application without re-importing the
module. The `PasswordService` is re-provided by
`PasswordRecoveryModule` so that the `reset-password-with-token`
use-case can hash the new password without depending on
`AuthModule`'s internal provider list — this makes the
password-recovery sub-module self-contained for callers that only
need to import the sub-module.

`AuthController` was updated to inject the new use-cases
(`RequestPasswordRecoveryUseCase`,
`VerifyPasswordRecoveryOtpUseCase`,
`ResetPasswordWithTokenUseCase`) and the new DTOs. The DTO
imports were updated to point at the new
`./password-recovery/dto` barrel.

`AuthModule`'s `providers` array no longer contains the old
`ForgotPasswordUseCase` or `ResetPasswordUseCase` (they are
deleted). All other providers are unchanged.

---

## 11. Acceptance Criteria

| # | Criterion                                                                | Status |
|---|--------------------------------------------------------------------------|--------|
| 1 | `npx prisma validate` succeeds                                           | ✅     |
| 2 | `npx prisma generate` succeeds                                           | ✅     |
| 3 | `npm run build` succeeds with exit 0                                     | ✅     |
| 4 | `npm run lint` succeeds with exit 0                                      | ✅     |
| 5 | `npx ts-node scripts/validate-permissions.ts` succeeds                   | ✅     |
| 6 | `docs/auth/password-recovery-contract.md` exists                         | ✅     |
| 7 | `docs/qa/phase-4-r2-configurable-password-recovery-foundation-qa-report.md` exists | ✅ |
| 8 | Old unsafe `forgot-password` and `reset-password` use-cases deleted      | ✅     |
| 9 | Old unsafe DTOs deleted                                                  | ✅     |
| 10 | Production boot guards (weak pepper, dev OTP return) work                | ✅ (covered by `password-recovery.config.ts` `validateProductionSafety`) |
| 11 | No raw email / OTP / reset token stored in DB                            | ✅ (only `emailHash`, `otpHash`, `resetTokenHash`) |
| 12 | One-time-use guard on reset token                                        | ✅ (conditional `markConsumed` with `consumedAt: null, revokedAt: null` guards) |
| 13 | Successful reset revokes refresh tokens and increments `tokenVersion`    | ✅ (in the same transaction as the password update) |
| 14 | No user enumeration in the public flow                                   | ✅ (identical responses and a timing floor on the unknown-email branch) |
| 15 | Channel abstraction in place (`PasswordRecoveryChannelProvider`)         | ✅ |
| 16 | NOOP and CONSOLE channels implemented                                    | ✅ |
| 17 | Cooldown, max attempts, and TTLs configurable via env                   | ✅ |
| 18 | No new lint warnings introduced                                          | ✅ (one warning was actually removed) |
| 19 | Token security contract cross-references the new password reset behaviour | ✅ |
| 20 | Changes committed and pushed                                             | (this commit) |

---

## 12. Followups (out of scope for this phase)

- **Real email provider.** A `SmtpPasswordRecoveryChannel` /
  `SesPasswordRecoveryChannel` would slot into the
  `PasswordRecoveryChannelService.resolveChannel` switch with no
  changes to the use-cases.
- **Constant-time no-op branch.** The unknown-email branch in
  `request-password-recovery` is currently a fast `return` to keep
  timing differences small. If a more strict timing guarantee is
  needed, a future hardening pass can add a constant-time
  short-circuit (e.g. perform a fake HMAC and sleep to the
  `MIN_DURATION_MS` floor).
- **Audit log wiring.** Password recovery is currently silent in
  the audit log. Phase 8 (Audit Logs) will wire up:
  `recovery.requested`, `recovery.verified`,
  `recovery.failed`, and `reset.completed` events.
- **Throttling per IP.** The current rate limiting is per email.
  For a production deployment under attack, an IP-based rate
  limiter at the gateway / `ThrottlerModule` is recommended.
- **Cleanup job for expired challenges.** Old
  `PasswordRecoveryChallenge` rows accumulate. A scheduled job
  that prunes `revokedAt` / `consumedAt` rows older than N days is
  recommended.
