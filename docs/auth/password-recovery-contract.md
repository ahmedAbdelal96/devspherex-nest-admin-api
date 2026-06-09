# Password Recovery Contract

## Phase 4-R2 — Configurable Password Recovery Foundation

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

Successful response (always the same, regardless of whether the email
exists):

```json
{
  "message": "If this email exists, password recovery instructions will be sent."
}
```

Status: `200 OK`.

In development only, when `PASSWORD_RECOVERY_DEV_RETURN_OTP=true`, the
response body additionally contains an `otp` field. The production
boot guard refuses to start when this flag is `true`.

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
unknown email, malformed payload):

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

Failure response (any reason — invalid token, expired, consumed, user
not active, etc.):

```json
{ "message": "Invalid or expired reset token." }
```

Status: `401 Unauthorized`.

---

## 4. Server-Side State Machine

Each recovery attempt is recorded as a `PasswordRecoveryChallenge` row:

```
                    ┌───────────────────────┐
                    │  initial (no OTP yet) │
                    │  revokedAt = null     │
                    │  consumedAt = null    │
                    │  otpVerifiedAt = null │
                    │  failedAttempts = 0   │
                    └──────────┬────────────┘
                               │ request-password-recovery
                               ▼
                    ┌───────────────────────┐
                    │  OTP issued           │
                    │  otpHash set          │
                    │  otpExpiresAt set      │
                    └──────────┬────────────┘
                               │ verify-password-recovery-otp
                  correct      │      wrong
                  ─────────────┼──────────────
                               ▼
                    ┌───────────────────────┐  ┌────────────────────┐
                    │  otpVerifiedAt set    │  │  failedAttempts++  │
                    │  resetTokenHash set   │  │  if >= max:        │
                    │  resetTokenExpiresAt  │  │    revokedAt = now │
                    └──────────┬────────────┘  └────────────────────┘
                               │ reset-password
                  consumed     │
                  ─────────────┼──────────────
                               ▼
                    ┌───────────────────────┐
                    │  consumedAt = now     │
                    │  password updated     │
                    │  tokenVersion += 1    │
                    │  all refresh tokens   │
                    │    for user revoked   │
                    │  other active         │
                    │    challenges revoked │
                    └───────────────────────┘
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
  id                   String                  @id @default(cuid())
  purpose              PasswordRecoveryPurpose @default(PASSWORD_RESET)
  userId               String?                 // null when the email is unknown
  user                 User?                   @relation(...)
  emailHash            String                  // HMAC-SHA256 of normalized email
  channel              PasswordRecoveryChannel // which channel the OTP was sent to

  // OTP — stored as HMAC of `<challengeId>:<otp>`. Never the raw OTP.
  otpHash              String?
  otpExpiresAt         DateTime?
  otpVerifiedAt        DateTime?

  // Reset session token — stored as HMAC of `<challengeId>.<secret>`.
  resetTokenHash       String?
  resetTokenExpiresAt  DateTime?

  // Lifecycle
  failedAttempts       Int                     @default(0)
  maxAttempts          Int
  revokedAt            DateTime?
  consumedAt           DateTime?

  // Audit context
  requestIp            String?
  userAgent            String?

  createdAt            DateTime                @default(now())
  updatedAt            DateTime                @updatedAt

  @@index([userId, purpose, revokedAt, consumedAt])
  @@index([emailHash, purpose, createdAt])
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

- Must be at least 16 characters in production.
- Must not be any of the well-known defaults (`change-me-in-production`,
  `changeme`, `pepper`, `secret`, `default`).
- The boot guard refuses to start the application in production if
  these conditions are violated.
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

- `PASSWORD_RECOVERY_PEPPER` must not be a weak default and must be
  ≥ 16 characters.
- `PASSWORD_RECOVERY_DEV_RETURN_OTP` must be `false`.
- `PASSWORD_RECOVERY_CHANNEL` set to `CONSOLE` or `NOOP` in production
  emits a warning but does not abort boot (some companies intentionally
  disable delivery in production while keeping the API surface).

---

## 8. Security Properties

### 8.1 No user enumeration

The public response to `POST /auth/forgot-password` is identical
regardless of whether the email exists. Internally:

- For known emails: a challenge is created, an OTP is generated, and
  the configured channel is invoked.
- For unknown emails: a no-op is performed; the channel is not invoked
  and no challenge is created.

The "verify" endpoint also returns the same generic error for unknown
emails, expired challenges, wrong OTPs, and locked-out challenges.

The response timing is not currently normalized, which is an accepted
tradeoff for Phase 4-R2 (a future hardening pass can add a constant-time
short-circuit for the unknown-email branch).

### 8.2 Cooldown

`PASSWORD_RECOVERY_RESEND_COOLDOWN_SECONDS` is enforced **per
`emailHash`**. When a new request arrives within the cooldown window
of the previous one, the new request is silently dropped (no error,
no delivery) so the response is identical to a normal request.

The cooldown is enforced for both known and unknown emails, so an
attacker cannot bypass the rate limit by probing random addresses.

### 8.3 Max failed attempts

`PASSWORD_RECOVERY_MAX_VERIFY_ATTEMPTS` caps the number of wrong OTPs
per challenge. When exceeded, the challenge is revoked and any further
attempt against it returns the generic invalid-code error.

The increment is performed with an atomic `updateMany` so concurrent
attempts cannot race past the cap.

### 8.4 One-time-use reset token

The reset session token is bound to the challenge. After a successful
`POST /auth/reset-password`:

- `consumedAt` is set via a conditional `updateMany` with
  `consumedAt: null, revokedAt: null` guards. A double-submit cannot
  apply the password change twice.
- The token cannot be replayed even if the same secret were re-leaked
  later, because the `consumedAt` guard rejects it.

### 8.5 Session invalidation on reset

When `PASSWORD_RECOVERY_REVOKE_SESSIONS_ON_SUCCESS=true` (default), a
successful password reset runs the following inside a single Prisma
transaction:

1. `user.passwordHash` is updated to the new hash.
2. All `RefreshToken` rows for the user are revoked
   (`revokedAt = now()`).
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

`CONSOLE` and `NOOP` channels in production only write to the server
log / nothing. They never attempt network calls. A warning is emitted
at boot if either is configured in production.

### 8.9 Generic error for disabled feature

When `PASSWORD_RECOVERY_ENABLED=false`, all three endpoints return
`400 Bad Request` with the message
`"Password recovery is not available"`. This deliberately does not
differentiate from other client errors to avoid advertising the
existence of the feature.

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
