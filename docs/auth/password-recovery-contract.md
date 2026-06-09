# Password Recovery Contract

## Phases 4-R2 + 4-R3 — Configurable Password Recovery Foundation & Hardening

---

## 1. Overview

The password recovery subsystem allows a user to regain access to their
account when they have forgotten their password. It is composed of three
public endpoints (no authentication required) and a small server-side
state machine backed by the `PasswordRecoveryChallenge` Prisma model.

All state is server-side; clients never receive anything that lets them
short-circuit the flow. OTPs and reset session tokens are HMAC-hashed
before they are stored, and the raw values are never written to the
database.

Phase 4-R3 hardened the subsystem: the reset-password transaction is
now fully atomic, unknown-email cooldowns are enforced via a marker
challenge, the `devReturnOtp` field flows through the controller, and
production boot guards refuse CONSOLE/NOOP channels when recovery is
enabled.

---

## 2. Endpoints

| Method | Path                                          | Auth | Purpose                                      |
| ------ | --------------------------------------------- | ---- | -------------------------------------------- |
| POST   | `/auth/forgot-password`                       | none | Request an OTP for the given email           |
| POST   | `/auth/verify-password-recovery-otp`          | none | Verify the OTP, receive a reset session token |
| POST   | `/auth/reset-password`                        | none | Submit the new password using the reset token |

All endpoints are classified `@Public()`. The global `JwtAuthGuard`
allows them through without a JWT; the global `PermissionsGuard` does
not check permissions for `@Public()` routes.

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
additionally contains an `otp` field so integration tests can pick it
up. The production boot guard refuses to start the app when this flag
is `true`.

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

Failure response (any reason — wrong code, expired, too many attempts,
unknown email, marker challenge, malformed payload):

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

- **Real challenge** — `isMarker=false`, has a real user, an `otpHash`,
  and a `otpExpiresAt`. Created for known emails.
- **Marker challenge** — `isMarker=true`, `userId=null`, no `otpHash`,
  no `otpExpiresAt`. Created for unknown emails as a cooldown / timing
  placeholder.

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
  // occupy the emailHash slot for cooldown and timing-balance purposes.
  // Marker challenges have no OTP and can never be verified or consumed.
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

- The raw email is **never** stored. Only `emailHash` is persisted, which
  is `HMAC-SHA256(serverPepper, normalize(email))`. This is a
  deterministic fingerprint that lets the server look up active
  challenges for cooldown enforcement without keeping the email in
  cleartext.
- The raw OTP is **never** stored. The server stores
  `HMAC-SHA256(serverPepper, "<challengeId>:<otp>")`. Because the input
  includes the challenge id, the same OTP value cannot match a
  different challenge.
- The raw reset session token secret is **never** stored. The server
  stores `HMAC-SHA256(serverPepper, "<challengeId>.<secret>")`.
- Marker challenges have `otpHash=null`, `otpExpiresAt=null`,
  `userId=null`, and `isMarker=true`. The verify and reset use-cases
  filter out markers, so they can never produce a reset session token
  or be consumed.

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
  least 16 characters and must not be any of the well-known defaults
  (`change-me-in-production`, `changeme`, `pepper`, `secret`,
  `default`, empty string).
- When `PASSWORD_RECOVERY_ENABLED=false` in production: the strict
  validation is relaxed (a weak pepper only emits a warning) because
  the pepper is not used in that case.
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

- `safeEqual` parses both hex strings into `Uint8Array` and compares
  with `timingSafeEqual`. Mismatched lengths short-circuit to `false`
  (length-leak is harmless for hex strings of identical algorithms).
  Malformed hex short-circuits to `false` and is not thrown, so the
  caller can treat all invalid-token cases with a single error path.

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

**Production boot guards:**

- `PASSWORD_RECOVERY_DEV_RETURN_OTP=true` is always rejected in
  production, regardless of `PASSWORD_RECOVERY_ENABLED`.
- When `PASSWORD_RECOVERY_ENABLED=true` in production:
  - `PASSWORD_RECOVERY_PEPPER` must be a strong, non-default value
    of at least 16 characters.
  - `PASSWORD_RECOVERY_CHANNEL` must NOT be `CONSOLE` or `NOOP`.
    Recovery in production requires a real delivery channel
    (`EMAIL`, `WHATSAPP`, or `SMS`).
- When `PASSWORD_RECOVERY_ENABLED=false` in production: the strict
  pepper validation is relaxed; a weak pepper only emits a warning.
  This is because the pepper is not used when recovery is disabled.

For local development, a committed `.env.example` ships with safe
defaults and inline comments explaining each variable.

---

## 8. Security Properties

### 8.1 No user enumeration

The public response to `POST /auth/forgot-password` is identical
regardless of whether the email exists. Internally:

- For known emails: a real challenge is created, an OTP is generated,
  and the configured channel is invoked.
- For unknown emails: a marker challenge is created
  (`isMarker=true`, `userId=null`, no OTP), the channel is not
  invoked, and no OTP is generated.

The "verify" endpoint also returns the same generic error for unknown
emails, expired challenges, wrong OTPs, locked-out challenges, and
marker challenges.

The response body in production never contains the OTP. In non-
production with `PASSWORD_RECOVERY_DEV_RETURN_OTP=true`, the response
additionally includes an `otp` field for testing.

### 8.2 Cooldown (works for both known and unknown emails)

`PASSWORD_RECOVERY_RESEND_COOLDOWN_SECONDS` is enforced **per
`emailHash`**. The cooldown check uses
`findLatestByEmail`, which includes both real and marker challenges.
When a new request arrives within the cooldown window of the previous
one, the new request is silently dropped (no error, no new challenge,
no delivery) so the response is identical to a normal request.

This is implemented as a `PasswordRecoveryChallenge` row whose
`createdAt` timestamp anchors the cooldown. Real challenges and
marker challenges both anchor cooldown equally, so an attacker
cannot bypass the rate limit by probing random addresses.

### 8.3 Max failed attempts

`PASSWORD_RECOVERY_MAX_VERIFY_ATTEMPTS` caps the number of wrong OTPs
per challenge. When exceeded, the challenge is revoked and any further
attempt against it returns the generic invalid-code error.

The increment is performed inside an interactive transaction that
also handles the "should revoke?" decision, so concurrent attempts
cannot race past the cap. Marker challenges are excluded from this
mechanism (their `failedAttempts` stays at 0 and `incrementFailedAttempts`
is a no-op for them).

### 8.4 One-time-use reset token (atomic with side effects)

The reset session token is bound to the challenge. The reset-password
use-case now performs **all** side effects inside a single Prisma
interactive transaction:

1. **Conditionally mark the challenge as consumed** (one-time-use
   guard). The conditional `updateMany` includes guards for
   `isMarker=false`, `revokedAt=null`, `consumedAt=null`,
   `otpVerifiedAt!=null`, `resetTokenHash!=null`,
   `resetTokenExpiresAt>now`, and `userId=<expected user>`. If the
   count is 0, the use-case throws `UnauthorizedException` and the
   transaction is rolled back.
2. Update the user `passwordHash`.
3. If `PASSWORD_RECOVERY_REVOKE_SESSIONS_ON_SUCCESS=true`:
   - Revoke all `RefreshToken` rows for the user (`revokedAt = now`).
   - Increment `user.tokenVersion` by 1.
4. Revoke every other active `PasswordRecoveryChallenge` for the same
   user (`revokedAt = now`).

If any step inside the transaction throws, Prisma rolls back the
entire group. The challenge is not consumed, the password is not
updated, refresh tokens are not revoked, and `tokenVersion` is not
incremented. This eliminates the previous hazard where
`markConsumed()` ran outside the transaction and could leave the
system in an inconsistent state.

### 8.5 Session invalidation on reset

When `PASSWORD_RECOVERY_REVOKE_SESSIONS_ON_SUCCESS=true` (default), a
successful password reset runs the following inside the same
transaction as the password update:

1. `user.passwordHash` is updated.
2. All `RefreshToken` rows for the user are revoked.
3. `user.tokenVersion` is incremented by 1.

The `tokenVersion` increment is what invalidates the user's access
tokens — the `JwtStrategy` from Phase 3 rejects any access token whose
`tokenVersion` does not match the user's current `tokenVersion`.

### 8.6 Other challenges revoked

Within the same transaction, every other active
`PasswordRecoveryChallenge` for the same user is also revoked, so the
user cannot have two parallel reset windows open.

### 8.7 Channel errors never leak

If the configured channel throws (e.g. the console logger fails), the
error is caught and logged, but the public response is still the
generic success message. This avoids leaking infrastructure details
through the public auth surface.

### 8.8 Channel in production

When `PASSWORD_RECOVERY_ENABLED=true` in production, the boot guard
**rejects** `CONSOLE` and `NOOP` channels outright. The
implementation rationale is that recovery is on, and a delivery
channel that cannot reach a real user is a footgun, not a feature.

When `PASSWORD_RECOVERY_ENABLED=false` in production, `CONSOLE` and
`NOOP` are accepted (the feature is off, so the channel is never
used).

### 8.9 Generic error for disabled feature

When `PASSWORD_RECOVERY_ENABLED=false`, all three endpoints return
`400 Bad Request` with the message
`"Password recovery is not available"`. This deliberately does not
differentiate from other client errors to avoid advertising the
existence of the feature.

### 8.10 Request IP and User-Agent capture

The `forgot-password` controller extracts the client IP and User-
Agent from the incoming Express request and passes them to the
use-case, which stores them on the challenge row. This is useful for
forensics and rate-limiting, and matches the `requestIp` / `userAgent`
columns on `PasswordRecoveryChallenge`. Both fields are optional; the
use-case falls back to `null` when the request has no IP/UA.

### 8.11 devReturnOtp behavior

- When `PASSWORD_RECOVERY_DEV_RETURN_OTP=true` AND the environment
  is not production: the forgot-password response includes an
  additional `otp` field with the raw OTP. This is for integration
  tests only.
- When `PASSWORD_RECOVERY_DEV_RETURN_OTP=true` AND the environment
  is production: the boot guard refuses to start the application.
- When `PASSWORD_RECOVERY_DEV_RETURN_OTP=false`: the response never
  contains the OTP.

---

## 9. Channel Abstraction

Adding a new channel (e.g. a real email provider) requires:

1. Implement `PasswordRecoveryChannelProvider` in
   `src/modules/auth/password-recovery/channels/`.
2. Register the new channel as a provider in `password-recovery.module.ts`.
3. Inject it into `PasswordRecoveryChannelService` and add a `case`
   to `resolveChannel`.

No use-case ever imports a specific channel — they only depend on
`PasswordRecoveryChannelService`, which keeps the use-cases
channel-agnostic and makes the subsystem testable with the `NOOP`
channel.

### 9.1 Built-in channels

- **NoopPasswordRecoveryChannel** — silently discards. Used in
  integration tests where the OTP is read from the
  `PASSWORD_RECOVERY_DEV_RETURN_OTP` response field.
- **ConsolePasswordRecoveryChannel** — logs the OTP to the server
  stdout, masking the destination email
  (`a***@example.com`). Refuses to log when `isProduction=true` to
  avoid accidentally printing OTPs in production logs.

**No real email, WhatsApp, or SMS provider is shipped with this
starter.** The `EMAIL` / `WHATSAPP` / `SMS` enum values exist to
anchor the type system, but `resolveChannel` returns `null` for
them, so an `EMAIL` channel in production currently logs a warning
and silently drops the OTP. Production deployments that need a real
channel must implement one.

---

## 10. Module Structure

```
src/modules/auth/password-recovery/
├── password-recovery.module.ts            (NestJS @Global module)
├── password-recovery.config.ts            (env loading + production safety)
├── password-recovery.constants.ts         (defaults, generic messages)
├── password-recovery.types.ts             (channel + purpose constants/types)
├── channels/
│   ├── password-recovery-channel.interface.ts
│   ├── noop-password-recovery.channel.ts
│   └── console-password-recovery.channel.ts
├── repositories/
│   └── password-recovery.repository.ts    (Prisma access)
├── services/
│   ├── password-recovery-hashing.service.ts
│   ├── password-recovery-token.service.ts
│   ├── password-recovery-policy.service.ts
│   └── password-recovery-channel.service.ts
├── dto/
│   ├── request-password-recovery.dto.ts
│   ├── verify-password-recovery-otp.dto.ts
│   ├── reset-password-with-token.dto.ts
│   └── index.ts
└── use-cases/
    ├── request-password-recovery.use-case.ts
    ├── verify-password-recovery-otp.use-case.ts
    ├── reset-password-with-token.use-case.ts
    └── index.ts
```

The module is registered as `@Global()` so that `PasswordService` (re-
used for hashing the new password on reset) and the `use-cases` can
be injected anywhere in the application without re-importing the
module.

---

## 11. Cross-References

- [Token Security Contract](token-security-contract.md) — explains how
  `tokenVersion` is checked by `JwtStrategy`, which is what makes
  session invalidation work on a successful password reset.
- [RBAC Guards Contract](../rbac/rbac-guards-contract.md) — explains
  the default-deny posture and the role of `@Public()`. All three
  password-recovery endpoints are classified `@Public()`.
- [.env.example](../../.env.example) — committed template with safe
  dev defaults and inline comments for every `PASSWORD_RECOVERY_*`
  variable.

---

## 12. Version History

| Version | Date       | Phase    | Changes                                                                          |
| ------- | ---------- | -------- | -------------------------------------------------------------------------------- |
| 1.1.0   | 2026-06-09 | 4-R3     | Atomic reset transaction; unknown-email markers; controller devOtp + IP/UA pass; production channel hardening; .env.example |
| 1.0.0   | 2026-06-09 | 4-R2     | Initial PasswordRecoveryChallenge model, 3 use-cases, 2 channels, env config    |
