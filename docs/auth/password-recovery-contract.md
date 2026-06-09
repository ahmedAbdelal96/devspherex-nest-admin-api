# Password Recovery Contract

## Phases 4-R2 + 4-R3 + 4-R4 + 4-R4-R1 — Configurable Password Recovery Foundation, Hardening, Provider Readiness, and DI Cycle Fix

---

## 1. Overview

The password recovery subsystem allows a user to regain access to
their account when they have forgotten their password. It is composed
of three public endpoints (no authentication required) and a small
server-side state machine backed by the `PasswordRecoveryChallenge`
Prisma model.

All state is server-side; clients never receive anything that lets
them short-circuit the flow. OTPs and reset session tokens are
HMAC-hashed before they are stored, and the raw values are never
written to the database.

Phase 4-R3 hardened the subsystem: the reset-password transaction
is fully atomic, unknown-email cooldowns are enforced via a marker
challenge, the `devOtp` field flows through the controller, and
production boot guards refuse CONSOLE/NOOP channels when recovery
is enabled.

Phase 4-R4 closes the remaining production-readiness and contract
gaps:

- A real provider must exist for a production deployment to enable
  recovery. The boot guard now refuses
  `PASSWORD_RECOVERY_ENABLED=true` in production unless the selected
  channel reports as production-ready. Currently, no channel in
  this starter is production-ready, so the only safe production
  posture is `PASSWORD_RECOVERY_ENABLED=false`.
- The dev-OTP response field is now uniformly named `devOtp` in
  the use-case, the controller, and the docs.
- An optional, configurable timing floor
  (`PASSWORD_RECOVERY_MIN_RESPONSE_MS`) flattens the observable
  timing gap between the known-email and unknown-email branches.
  It is a defensive layer only; it is not a hard constant-time
  guarantee.

Phase 4-R4-R1 is a repair pass over Phase 4-R4:

- **Removes the runtime DI cycle** that Phase 4-R4 introduced
  between `PasswordRecoveryConfig` (which called readiness
  predicates) and `PasswordRecoveryChannelService` (which the
  config injected to call them). Phase 4-R4-R1 moves the
  readiness logic to a **pure helper file** that has no
  NestJS DI decorators. Both `PasswordRecoveryConfig` and
  `PasswordRecoveryChannelService` call the pure helper
  directly, so there is exactly one source of truth and no
  circular DI dependency.
- **Fixes the config key mismatch** between
  `src/config/configuration.ts` and
  `PasswordRecoveryConfig`. The configuration namespace
  previously exposed `maxAttempts` while the config class
  read `maxVerifyAttempts`, which silently fell back to the
  default. Phase 4-R4-R1 renames the configuration key to
  `maxVerifyAttempts` so they match.

---

## 2. Endpoints

| Method | Path                                          | Auth | Purpose                                      |
| ------ | --------------------------------------------- | ---- | -------------------------------------------- |
| POST   | `/auth/forgot-password`                       | none | Request an OTP for the given email           |
| POST   | `/auth/verify-password-recovery-otp`          | none | Verify the OTP, receive a reset session token |
| POST   | `/auth/reset-password`                        | none | Submit the new password using the reset token |

All endpoints are classified `@Public()`. The global `JwtAuthGuard`
allows them through without a JWT; the global `PermissionsGuard`
does not check permissions for `@Public()` routes.

---

## 3. Public Flow

### 3.1 Request an OTP

```
POST /auth/forgot-password
Content-Type: application/json

{ "email": "alice@example.com" }
```

Successful response (always the same in production, regardless of
whether the email exists):

```json
{
  "message": "If this email exists, password recovery instructions will be sent."
}
```

Status: `200 OK`.

In non-production environments only, when
`PASSWORD_RECOVERY_DEV_RETURN_OTP=true`, the response body
additionally contains a `devOtp` field with the raw OTP, so
integration tests can pick it up. The production boot guard refuses
to start the app when this flag is `true`.

`devOtp` is included ONLY when **all** of the following hold:

- The environment is not production.
- `PASSWORD_RECOVERY_DEV_RETURN_OTP=true`.
- A real challenge was actually created — i.e. a known user
  triggered the flow and cooldown did not block the request.

`devOtp` is NEVER present:

- In production (boot refuses to start).
- For unknown-email marker requests.
- When cooldown blocks a new OTP.

### 3.2 Verify the OTP

```
POST /auth/verify-password-recovery-otp
Content-Type: application/json

{ "email": "alice@example.com", "otp": "123456" }
```

Successful response:

```json
{
  "resetSessionToken": "<challengeId>.<64 hex chars>",
  "expiresIn": 600
}
```

Status: `200 OK`.

Failure response (any reason — wrong code, expired, too many
attempts, unknown email, marker challenge, malformed payload):

```json
{ "message": "Invalid or expired verification code." }
```

Status: `401 Unauthorized`.

### 3.3 Reset the password

```
POST /auth/reset-password
Content-Type: application/json

{
  "resetSessionToken": "<challengeId>.<64 hex chars>",
  "newPassword": "new-strong-password"
}
```

Successful response:

```json
{ "message": "Password has been reset successfully." }
```

Status: `200 OK`.

Failure response (any reason — invalid token, expired, consumed,
marker, user not active, etc.):

```json
{ "message": "Invalid or expired reset token." }
```

Status: `401 Unauthorized`.

---

## 4. Server-Side State Machine

Each recovery attempt is recorded as a `PasswordRecoveryChallenge`
row. There are two kinds of rows:

- **Real challenge** — `isMarker=false`, has a real user, an
  `otpHash`, and a `otpExpiresAt`. Created for known emails.
- **Marker challenge** — `isMarker=true`, `userId=null`, no
  `otpHash`, no `otpExpiresAt`. Created for unknown emails as a
  cooldown / timing placeholder.

```
                    ┌───────────────────────┐
                    │  initial (no OTP yet) │
                    │  revokedAt = null     │
                    │  consumedAt = null    │
                    │  otpVerifiedAt = null │
                    │  failedAttempts = 0   │
                    └──────────┬────────────┘
                               │ request-password-recovery
                  known email  │  unknown email
                  ─────────────┼──────────────
                               ▼                              ▼
                    ┌───────────────────────┐    ┌───────────────────────┐
                    │  Real challenge       │    │  Marker challenge     │
                    │  isMarker = false     │    │  isMarker = true      │
                    │  userId set           │    │  userId = null        │
                    │  otpHash set          │    │  otpHash = null       │
                    │  otpExpiresAt set     │    │  otpExpiresAt = null  │
                    │  channel dispatched   │    │  no dispatch          │
                    └──────────┬────────────┘    └──────────┬────────────┘
                               │ verify-password-recovery-otp
                  correct      │      wrong
                  ─────────────┼──────────────
                               ▼                              ▼
                    ┌───────────────────────┐  ┌────────────────────┐
                    │  otpVerifiedAt set    │  │  failedAttempts++  │
                    │  resetTokenHash set   │  │  if >= max:        │
                    │  resetTokenExpiresAt  │  │    revokedAt = now │
                    └──────────┬────────────┘  └────────────────────┘
                               │ reset-password
                  consumed (atomic) │
                  ──────────────────┼──────────────────
                               ▼
                    ┌───────────────────────────────────────┐
                    │  consumedAt = now                     │
                    │  password updated                     │
                    │  tokenVersion += 1                    │
                    │  all refresh tokens for user revoked  │
                    │  other active challenges revoked      │
                    │  ALL in a single Prisma transaction   │
                    └───────────────────────────────────────┘
```

---

## 5. PasswordRecoveryChallenge Model

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

model PasswordRecoveryChallenge {
  id                  String                  @id @default(uuid())
  userId              String?                 // null for marker challenges
  user                User?                   @relation(...)
  emailHash           String                  // HMAC-SHA256 of normalized email
  purpose             PasswordRecoveryPurpose @default(PASSWORD_RESET)
  channel             PasswordRecoveryChannel @default(NOOP)

  // OTP — null for marker challenges.
  otpHash             String?
  otpExpiresAt        DateTime?
  otpVerifiedAt       DateTime?

  // Reset session token — HMAC of `<challengeId>.<secret>`. Never the raw token.
  resetTokenHash      String?
  resetTokenExpiresAt DateTime?

  // Lifecycle
  failedAttempts      Int                     @default(0)
  maxAttempts         Int                     @default(5)
  revokedAt           DateTime?
  consumedAt          DateTime?

  // Cooldown placeholder flag. When true, the row exists only to
  // occupy the emailHash slot for cooldown and timing-balance
  // purposes. Marker challenges have no OTP and can never be
  // verified or consumed.
  isMarker            Boolean                 @default(false)

  // Audit context
  requestIp           String?
  userAgent           String?

  createdAt           DateTime                @default(now())
  updatedAt           DateTime                @updatedAt

  @@index([userId, purpose, revokedAt, consumedAt])
  @@index([emailHash, purpose, createdAt])
  @@index([emailHash, purpose, isMarker, createdAt])
  @@index([createdAt])
}
```

**Important invariants:**

- The raw email is **never** stored. Only `emailHash` is persisted,
  which is `HMAC-SHA256(serverPepper, normalize(email))`. This is
  a deterministic fingerprint that lets the server look up active
  challenges for cooldown enforcement without keeping the email in
  cleartext.
- The raw OTP is **never** stored. The server stores
  `HMAC-SHA256(serverPepper, "<challengeId>:<otp>")`. Because the
  input includes the challenge id, the same OTP value cannot match
  a different challenge.
- The raw reset session token secret is **never** stored. The
  server stores `HMAC-SHA256(serverPepper, "<challengeId>.<secret>")`.
- Marker challenges have `otpHash=null`, `otpExpiresAt=null`,
  `userId=null`, and `isMarker=true`. The verify and reset
  use-cases filter out markers, so they can never produce a reset
  session token or be consumed.

---

## 6. Hashing and Cryptography

All hashing uses Node's built-in `crypto` module.

| Operation        | Input                                         | Output                                       |
| ---------------- | --------------------------------------------- | -------------------------------------------- |
| Email fingerprint| `normalize(email)` (trim + lowercase)         | `HMAC-SHA256(pepper, email)` (hex)           |
| OTP hash         | `"<challengeId>:<otp>"`                       | `HMAC-SHA256(pepper, input)` (hex)           |
| Reset token hash | `"<challengeId>.<secret>"`                    | `HMAC-SHA256(pepper, input)` (hex)           |
| Token comparison | two hex strings of equal length               | `timingSafeEqual` over `Uint8Array`          |

**Pepper (`PASSWORD_RECOVERY_PEPPER`):**

- When `PASSWORD_RECOVERY_ENABLED=true` in production: must be at
  least 16 characters and must not be any of the well-known
  defaults (`change-me-in-production`, `changeme`, `pepper`,
  `secret`, `default`, empty string).
- When `PASSWORD_RECOVERY_ENABLED=false` in production: the strict
  validation is relaxed (a weak pepper only emits a warning)
  because the pepper is not used in that case.
- The boot guard refuses to start the application if the strict
  validation fails.
- The pepper is never logged and never returned in any response.

**OTP generation:**

- 6 digits (configurable 4..10) generated by `crypto.randomInt`.
- Zero-padded to the configured length.

**Reset session token generation:**

- 32 random bytes from `crypto.randomBytes`, hex-encoded (64 chars).
- The full token delivered to the client is
  `"<challengeId>.<secret>"`.

**Constant-time comparison:**

- `safeEqual` parses both hex strings into `Uint8Array` and
  compares with `timingSafeEqual`. Mismatched lengths short-circuit
  to `false` (length-leak is harmless for hex strings of identical
  algorithms). Malformed hex short-circuits to `false` and is not
  thrown, so the caller can treat all invalid-token cases with a
  single error path.

---

## 7. Configuration

All values are read from environment variables, exposed at
`config.passwordRecovery.*`.

| Env variable                                  | Default            | Range / values                          |
| --------------------------------------------- | ------------------ | --------------------------------------- |
| `PASSWORD_RECOVERY_ENABLED`                   | `true`             | `true` / `false`                        |
| `PASSWORD_RECOVERY_CHANNEL`                   | `CONSOLE`          | `NOOP`, `CONSOLE`, `EMAIL`, `WHATSAPP`, `SMS` |
| `PASSWORD_RECOVERY_OTP_LENGTH`                | `6`                | 4..10                                   |
| `PASSWORD_RECOVERY_OTP_TTL_SECONDS`           | `300`              | 30..3600                                |
| `PASSWORD_RECOVERY_RESET_TOKEN_TTL_SECONDS`   | `600`              | 60..3600                                |
| `PASSWORD_RECOVERY_RESEND_COOLDOWN_SECONDS`   | `60`               | 0..3600                                 |
| `PASSWORD_RECOVERY_MAX_VERIFY_ATTEMPTS`       | `5`                | 1..20                                   |
| `PASSWORD_RECOVERY_REVOKE_SESSIONS_ON_SUCCESS`| `true`             | `true` / `false`                        |
| `PASSWORD_RECOVERY_PEPPER`                    | dev-only default   | string, ≥16 chars in production         |
| `PASSWORD_RECOVERY_DEV_RETURN_OTP`            | `false`            | `true` / `false` (refused in production)|
| `PASSWORD_RECOVERY_MIN_RESPONSE_MS`           | `0`                | 0..5000 (best-effort timing floor)      |

### 7.1 Provider readiness (Phase 4-R4 + 4-R4-R1)

**Phase 4-R4-R1: the source of truth is a pure helper file,
not a DI service.**

`src/modules/auth/password-recovery/password-recovery-channel-readiness.ts`
is the single source of truth for channel readiness. It is
intentionally NOT decorated with `@Injectable()` and does not
import any `@nestjs/*` symbols. It exports three pure functions:

- `isPasswordRecoveryChannelImplemented(channel)` — does the
  channel have a real `PasswordRecoveryChannelProvider`
  registered in this build?
- `isPasswordRecoveryChannelProductionReady(channel)` — is the
  channel safe to use in a live deployment?
- `getPasswordRecoveryChannelReadiness(channel)` — returns the
  full record `{ implemented, productionReady, reason }`.

The current readiness table:

| Channel    | `implemented` | `productionReady` | `reason`                                           |
| ---------- | ------------- | ----------------- | -------------------------------------------------- |
| `NOOP`     | `true`        | `false`           | NOOP discards delivery and is dev/test only        |
| `CONSOLE`  | `true`        | `false`           | CONSOLE logs OTPs and is dev/test only             |
| `EMAIL`    | `false`       | `false`           | EMAIL provider is not implemented in this starter  |
| `WHATSAPP` | `false`       | `false`           | WHATSAPP provider is not implemented in this starter |
| `SMS`      | `false`       | `false`           | SMS provider is not implemented in this starter    |

`PasswordRecoveryChannelService` still exposes
`isChannelImplemented(channel)` and
`isChannelProductionReady(channel)` for backward compatibility
with Phase 4-R4 callers, but these are thin delegations to the
pure helper. There is exactly one source of truth.

**Why a pure file?** Phase 4-R4 placed the readiness predicates
on `PasswordRecoveryChannelService` and had `PasswordRecoveryConfig`
inject the service to call them. This created a runtime DI
cycle (`PasswordRecoveryConfig` → `PasswordRecoveryChannelService`
→ `PasswordRecoveryConfig`). Phase 4-R4-R1 moves the logic to a
pure file so neither class depends on the other for readiness
checks. The cycle is broken without `forwardRef`.

When a real provider is added in a future phase, the implementer
must:

1. Implement `PasswordRecoveryChannelProvider` in a new file
   under `channels/`.
2. Register the new channel as a provider in
   `password-recovery.module.ts`.
3. Inject it into `PasswordRecoveryChannelService` and add a
   `case` to `resolveChannel`.
4. Update the `READINESS` table in
   `password-recovery-channel-readiness.ts` to flip
   `implemented` and (when the provider is genuinely safe for
   production) `productionReady`.

### 7.2 Production boot guards (Phase 4-R4)

The boot guard in `PasswordRecoveryConfig` runs at module
construction time and refuses to start the application in the
following cases:

- **Always in production:**
  - `PASSWORD_RECOVERY_DEV_RETURN_OTP=true` — refused (regardless
    of `PASSWORD_RECOVERY_ENABLED`).
- **In production, when `PASSWORD_RECOVERY_ENABLED=true`:**
  - `PASSWORD_RECOVERY_CHANNEL` not implemented (i.e. one of
    `EMAIL`, `WHATSAPP`, `SMS`) — refused.
  - `PASSWORD_RECOVERY_CHANNEL` implemented but not
    production-ready (i.e. `CONSOLE` or `NOOP`) — refused.
  - `PASSWORD_RECOVERY_PEPPER` is a known weak default — refused.
  - `PASSWORD_RECOVERY_PEPPER` is shorter than 16 characters —
    refused.
- **In production, when `PASSWORD_RECOVERY_ENABLED=false`:**
  - `PASSWORD_RECOVERY_PEPPER` weak / short — only a warning, not
    a refusal (the pepper is not used when recovery is off).

For local development, a committed `.env.example` ships with safe
defaults and inline comments explaining each variable.

### 7.3 Config key contract (Phase 4-R4-R1)

`src/config/configuration.ts` exposes the password-recovery
namespace. Every key the namespace exports MUST match a key
that `PasswordRecoveryConfig` reads via `ConfigService.get`. If
the namespace and the config class drift, the consumer silently
falls back to the default value and the env variable has no
effect.

Phase 4-R4-R1 audit:

| Env variable                                  | Config namespace key                | Config class reads                                      |
| --------------------------------------------- | ----------------------------------- | ------------------------------------------------------- |
| `PASSWORD_RECOVERY_ENABLED`                   | `passwordRecovery.enabled`          | `passwordRecovery.enabled`                              |
| `PASSWORD_RECOVERY_CHANNEL`                   | `passwordRecovery.channel`          | `passwordRecovery.channel`                              |
| `PASSWORD_RECOVERY_OTP_LENGTH`                | `passwordRecovery.otpLength`        | `passwordRecovery.otpLength`                            |
| `PASSWORD_RECOVERY_OTP_TTL_SECONDS`           | `passwordRecovery.otpTtlSeconds`    | `passwordRecovery.otpTtlSeconds`                        |
| `PASSWORD_RECOVERY_RESET_TOKEN_TTL_SECONDS`   | `passwordRecovery.resetTokenTtlSeconds` | `passwordRecovery.resetTokenTtlSeconds`              |
| `PASSWORD_RECOVERY_RESEND_COOLDOWN_SECONDS`   | `passwordRecovery.resendCooldownSeconds` | `passwordRecovery.resendCooldownSeconds`            |
| `PASSWORD_RECOVERY_MAX_VERIFY_ATTEMPTS`       | `passwordRecovery.maxVerifyAttempts`| `passwordRecovery.maxVerifyAttempts`                    |
| `PASSWORD_RECOVERY_REVOKE_SESSIONS_ON_SUCCESS`| `passwordRecovery.revokeSessionsOnSuccess` | `passwordRecovery.revokeSessionsOnSuccess`      |
| `PASSWORD_RECOVERY_PEPPER`                    | `passwordRecovery.pepper`           | `passwordRecovery.pepper`                               |
| `PASSWORD_RECOVERY_DEV_RETURN_OTP`            | `passwordRecovery.devReturnOtp`     | `passwordRecovery.devReturnOtp`                         |
| `PASSWORD_RECOVERY_MIN_RESPONSE_MS`           | `passwordRecovery.minResponseMs`    | `passwordRecovery.minResponseMs`                        |

**Phase 4-R4-R1 fix:** before this phase, the namespace
exposed `passwordRecovery.maxAttempts` while the config class
read `passwordRecovery.maxVerifyAttempts`. As a result,
`PASSWORD_RECOVERY_MAX_VERIFY_ATTEMPTS` was silently ignored
and the config class always used the default of `5`. Phase
4-R4-R1 renames the namespace key to `maxVerifyAttempts` so
they match. The dev-return-OTP, min-response-MS, and
revoke-sessions keys were already consistent before this phase
and remain so.

---

## 8. Security Properties

### 8.1 No user enumeration

The public response to `POST /auth/forgot-password` is identical
regardless of whether the email exists. Internally:

- For known emails: a real challenge is created, an OTP is
  generated, and the configured channel is invoked.
- For unknown emails: a marker challenge is created
  (`isMarker=true`, `userId=null`, no OTP), the channel is not
  invoked, and no OTP is generated.

The "verify" endpoint also returns the same generic error for
unknown emails, expired challenges, wrong OTPs, locked-out
challenges, and marker challenges.

The response body in production never contains the OTP. In
non-production with `PASSWORD_RECOVERY_DEV_RETURN_OTP=true`, the
response additionally includes a `devOtp` field for testing.

### 8.2 Cooldown (works for both known and unknown emails)

`PASSWORD_RECOVERY_RESEND_COOLDOWN_SECONDS` is enforced **per
`emailHash`**. The cooldown check uses
`findLatestByEmail`, which includes both real and marker
challenges. When a new request arrives within the cooldown window
of the previous one, the new request is silently dropped (no
error, no new challenge, no delivery) so the response is identical
to a normal request.

This is implemented as a `PasswordRecoveryChallenge` row whose
`createdAt` timestamp anchors the cooldown. Real challenges and
marker challenges both anchor cooldown equally, so an attacker
cannot bypass the rate limit by probing random addresses.

### 8.3 Max failed attempts

`PASSWORD_RECOVERY_MAX_VERIFY_ATTEMPTS` caps the number of wrong
OTPs per challenge. When exceeded, the challenge is revoked and
any further attempt against it returns the generic invalid-code
error.

The increment is performed inside an interactive transaction that
also handles the "should revoke?" decision, so concurrent attempts
cannot race past the cap. Marker challenges are excluded from
this mechanism (their `failedAttempts` stays at 0 and
`incrementFailedAttempts` is a no-op for them).

### 8.4 One-time-use reset token (atomic with side effects)

The reset session token is bound to the challenge. The
reset-password use-case performs **all** side effects inside a
single Prisma interactive transaction:

1. **Conditionally mark the challenge as consumed** (one-time-use
   guard). The conditional `updateMany` includes guards for
   `isMarker=false`, `revokedAt=null`, `consumedAt=null`,
   `otpVerifiedAt!=null`, `resetTokenHash!=null`,
   `resetTokenExpiresAt>now`, and `userId=<expected user>`. If
   the count is 0, the use-case throws `UnauthorizedException`
   and the transaction is rolled back.
2. Update the user `passwordHash`.
3. If `PASSWORD_RECOVERY_REVOKE_SESSIONS_ON_SUCCESS=true`:
   - Revoke all `RefreshToken` rows for the user
     (`revokedAt = now`).
   - Increment `user.tokenVersion` by 1.
4. Revoke every other active `PasswordRecoveryChallenge` for the
   same user (`revokedAt = now`).

If any step inside the transaction throws, Prisma rolls back the
entire group. The challenge is not consumed, the password is not
updated, refresh tokens are not revoked, and `tokenVersion` is
not incremented. This eliminates the previous hazard where
`markConsumed()` ran outside the transaction and could leave the
system in an inconsistent state.

### 8.5 Session invalidation on reset

When `PASSWORD_RECOVERY_REVOKE_SESSIONS_ON_SUCCESS=true` (default),
a successful password reset runs the following inside the same
transaction as the password update:

1. `user.passwordHash` is updated.
2. All `RefreshToken` rows for the user are revoked.
3. `user.tokenVersion` is incremented by 1.

The `tokenVersion` increment is what invalidates the user's
access tokens — the `JwtStrategy` from Phase 3 rejects any access
token whose `tokenVersion` does not match the user's current
`tokenVersion`.

### 8.6 Other challenges revoked

Within the same transaction, every other active
`PasswordRecoveryChallenge` for the same user is also revoked, so
the user cannot have two parallel reset windows open.

### 8.7 Channel errors never leak

If the configured channel throws (e.g. the console logger fails),
the error is caught and logged, but the public response is still
the generic success message. This avoids leaking infrastructure
details through the public auth surface.

### 8.8 Channel in production (Phase 4-R4)

When `PASSWORD_RECOVERY_ENABLED=true` in production, the boot
guard **rejects**:

- `CONSOLE` and `NOOP` — implemented but not production-ready.
- `EMAIL`, `WHATSAPP`, `SMS` — not implemented at all in this
  starter.

The implementation rationale is that recovery is on, and a
delivery channel that cannot reach a real user is a footgun, not
a feature. Until a real provider is added, the only safe
production posture is `PASSWORD_RECOVERY_ENABLED=false`.

When `PASSWORD_RECOVERY_ENABLED=false` in production, the channel
value is irrelevant; `CONSOLE` and `NOOP` are accepted for
consistency.

### 8.9 Generic error for disabled feature

When `PASSWORD_RECOVERY_ENABLED=false`, all three endpoints
return `400 Bad Request` with the message
`"Password recovery is not available"`. This deliberately does
not differentiate from other client errors to avoid advertising
the existence of the feature.

### 8.10 Request IP and User-Agent capture

The `forgot-password` controller extracts the client IP and
User-Agent from the incoming Express request and passes them to
the use-case, which stores them on the challenge row. This is
useful for forensics and rate-limiting, and matches the
`requestIp` / `userAgent` columns on `PasswordRecoveryChallenge`.
Both fields are optional; the use-case falls back to `null` when
the request has no IP/UA.

### 8.11 `devOtp` field name (Phase 4-R4)

The dev-only OTP field is uniformly named `devOtp` in the
use-case, the controller, the contract, and the QA report.

- `devOtp` only appears when:
  - The environment is not production.
  - `PASSWORD_RECOVERY_DEV_RETURN_OTP=true`.
  - A real challenge was actually created (known email, not in
    cooldown).
- `devOtp` never appears in production (boot refuses to start).
- `devOtp` never appears for unknown-email marker requests.
- `devOtp` never appears when cooldown blocks a new OTP.

### 8.12 Timing behavior (Phase 4-R4 — honest description)

The forgot-password use-case has two timing-related layers, and
this contract describes them honestly.

**Cooldown and DB-state parity (always on):**

The unknown-email branch creates a marker challenge, so the
cooldown check sees it. The known-email and unknown-email
branches both perform the same set of Prisma operations
(revoke old rows, create a new row). This narrows the
observable timing gap relative to a "fast-return on unknown"
implementation, but it is NOT a constant-time guarantee.

**Optional best-effort timing floor (opt-in):**

`PASSWORD_RECOVERY_MIN_RESPONSE_MS` (default `0` = disabled)
applies a `setTimeout`-based floor on every code path of the
forgot-password use-case. When set to a positive value
(e.g. 300-800 ms), the use-case measures the start time and
sleeps for the remaining duration before returning. The floor
applies to every branch — disabled, cooldown, unknown marker,
known email, channel failure — so callers cannot infer which
branch ran from the response time alone.

This is **not a hard constant-time guarantee**:

- `setTimeout` is best-effort. Event-loop scheduling jitter and
  concurrent work can make the actual sleep slightly longer or
  shorter than the requested duration.
- The known-email branch still does extra work (OTP generation,
  challenge update, channel dispatch) before reaching the floor.
  The floor only ensures the response is at least `MIN_RESPONSE_MS`,
  not that it is exactly `MIN_RESPONSE_MS` on every branch.

If a future hardening pass requires a stronger guarantee, the
recommended next step is to use a dedicated timer service
(separate from the event loop) and to remove the asymmetric work
from the known-email branch (e.g. perform the channel dispatch
after responding, with a buffered queue).

---

## 9. Channel Abstraction

Adding a new channel (e.g. a real email provider) requires:

1. Implement `PasswordRecoveryChannelProvider` in
   `src/modules/auth/password-recovery/channels/`.
2. Register the new channel as a provider in
   `password-recovery.module.ts`.
3. Inject it into `PasswordRecoveryChannelService` and add a
   `case` to `resolveChannel`.
4. Update `isChannelImplemented` to return `true` for the new
   channel.
5. Update `isChannelProductionReady` to return `true` once the
   provider is fully wired up and tested.

Until all five steps are done, the channel is not safe for
production use, and the boot guard will refuse to start a
production deployment with the channel selected while recovery
is enabled.

### 9.1 Built-in channels

- **NoopPasswordRecoveryChannel** — silently discards. Used in
  integration tests where the OTP is read from the
  `PASSWORD_RECOVERY_DEV_RETURN_OTP` response field.
- **ConsolePasswordRecoveryChannel** — logs the OTP to the
  server stdout, masking the destination email
  (`a***@example.com`). Refuses to log when `isProduction=true`
  to avoid accidentally printing OTPs in production logs.

**No real email, WhatsApp, or SMS provider is shipped with this
starter.** The `EMAIL` / `WHATSAPP` / `SMS` enum values exist to
anchor the type system, but `resolveChannel` returns `null` for
them, so an `EMAIL` channel in production currently refuses to
boot (Phase 4-R4), and an `EMAIL` channel in non-production logs
a warning and silently drops the OTP. Production deployments
that need a real channel must implement one and update the
readiness predicates.

---

## 10. Module Structure

```
src/modules/auth/password-recovery/
├── password-recovery.module.ts                          (NestJS @Global module)
├── password-recovery.config.ts                          (env loading + production safety)
├── password-recovery.constants.ts                       (defaults, generic messages)
├── password-recovery.types.ts                           (channel + purpose constants/types)
├── password-recovery-channel-readiness.ts               (Phase 4-R4-R1: pure readiness registry)
├── channels/
│   ├── password-recovery-channel.interface.ts
│   ├── noop-password-recovery.channel.ts
│   └── console-password-recovery.channel.ts
├── repositories/
│   └── password-recovery.repository.ts                  (Prisma access)
├── services/
│   ├── password-recovery-hashing.service.ts
│   ├── password-recovery-token.service.ts
│   ├── password-recovery-policy.service.ts
│   └── password-recovery-channel.service.ts             (Phase 4-R4 readiness predicates delegate to the pure helper)
├── dto/
│   ├── request-password-recovery.dto.ts
│   ├── verify-password-recovery-otp.dto.ts
│   ├── reset-password-with-token.dto.ts
│   └── index.ts
└── use-cases/
    ├── request-password-recovery.use-case.ts           (Phase 4-R4: timing floor)
    ├── verify-password-recovery-otp.use-case.ts
    ├── reset-password-with-token.use-case.ts
    └── index.ts
```

The module is registered as `@Global()` so that `PasswordService`
(re-used for hashing the new password on reset) and the
`use-cases` can be injected anywhere in the application without
re-importing the module.

**Phase 4-R4-R1 — readiness registry is a pure file (no DI):**
`password-recovery-channel-readiness.ts` is intentionally NOT
decorated with `@Injectable()` and does not import any
`@nestjs/*` symbols. It exports pure functions
(`isPasswordRecoveryChannelImplemented`,
`isPasswordRecoveryChannelProductionReady`,
`getPasswordRecoveryChannelReadiness`) that both
`PasswordRecoveryConfig` and `PasswordRecoveryChannelService`
call. This is the source of truth for channel readiness and
breaks the Phase 4-R4 DI cycle
(`PasswordRecoveryConfig` ↔ `PasswordRecoveryChannelService`).
See §7.1 for the readiness table.

---

## 11. Cross-References

- [Token Security Contract](token-security-contract.md) —
  explains how `tokenVersion` is checked by `JwtStrategy`, which
  is what makes session invalidation work on a successful
  password reset.
- [RBAC Guards Contract](../rbac/rbac-guards-contract.md) —
  explains the default-deny posture and the role of `@Public()`.
  All three password-recovery endpoints are classified
  `@Public()`.
- [.env.example](../../.env.example) — committed template with
  safe dev defaults and inline comments for every
  `PASSWORD_RECOVERY_*` variable.

---

## 12. Version History

| Version | Date       | Phase    | Changes                                                                          |
| ------- | ---------- | -------- | -------------------------------------------------------------------------------- |
| 1.2.1   | 2026-06-09 | 4-R4-R1  | Moved channel readiness to a pure helper (`password-recovery-channel-readiness.ts`); broke the Phase 4-R4 DI cycle between `PasswordRecoveryConfig` and `PasswordRecoveryChannelService`; fixed `passwordRecovery.maxVerifyAttempts` config key mismatch |
| 1.2.0   | 2026-06-09 | 4-R4     | Provider readiness (no real EMAIL/WA/SMS provider in this starter; production boot refuses non-ready channels); `devOtp` unified field name; optional `PASSWORD_RECOVERY_MIN_RESPONSE_MS` timing floor; honest timing claims |
| 1.1.0   | 2026-06-09 | 4-R3     | Atomic reset transaction; unknown-email markers; controller devOtp + IP/UA pass; production channel hardening; .env.example |
| 1.0.0   | 2026-06-09 | 4-R2     | Initial PasswordRecoveryChallenge model, 3 use-cases, 2 channels, env config    |
