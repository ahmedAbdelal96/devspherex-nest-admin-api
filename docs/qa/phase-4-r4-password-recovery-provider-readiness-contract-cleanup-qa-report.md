# Phase 4-R4 — Password Recovery Provider Readiness & Contract Cleanup QA Report

**Date:** 2026-06-09
**Phase:** 4-R4
**Scope:** Provider readiness for production, devOtp field-name
unification, timing-floor opt-in, honest timing-documentation
rewrite, contract refresh.

---

## 1. What Was Wrong After Phase 4-R3

Phase 4-R3 left the password-recovery subsystem in a defensible
state for the **happy path** of the known-email flow. Three
production-readiness and contract gaps remained, however:

| #  | Gap                                                                                                                          | Severity  |
| -- | ---------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1  | The production boot guard rejected "non-real" channels (`CONSOLE`/`NOOP`) but did not reject channels that were **not implemented at all**. The `EMAIL` / `WHATSAPP` / `SMS` enum values existed only as type anchors. If a future developer enabled `PASSWORD_RECOVERY_ENABLED=true` in production and selected `EMAIL`, the boot guard would have allowed it, and the dispatcher would have silently dropped the OTP, leaving the user with a feature that "works" until they actually need it. | **High** |
| 2  | The dev-OTP field name was implicit. The use-case returned `{ message, otp }` on the dev branch and the controller declared `{ message, devOtp }`. There was no shared type, so a future refactor that renamed one side but not the other would silently break the dev-only contract. | Medium |
| 3  | The "we are not vulnerable to timing attacks" claim in the contract was overstated. R3 narrowed the timing gap by giving both branches the same number of DB round-trips, but the known-email branch still did extra work (OTP generation, challenge update, channel dispatch) before returning. There was no opt-in timing floor for operators who wanted to flatten the gap further, and the documentation did not call out that R3's claim was "narrowed the gap", not "constant-time". | Medium |

R4 closes all three gaps without regressing the R3 fixes (atomic
reset transaction, unknown-email marker, controller devOtp, IP/UA
pass, production channel hardening).

---

## 2. Provider Readiness Fix

### 2.1 Two readiness predicates

`PasswordRecoveryChannelService` now exposes two readiness
predicates:

```ts
isChannelImplemented(channel: PasswordRecoveryChannel): boolean
isChannelProductionReady(_channel: PasswordRecoveryChannel): boolean
```

The current implementation is:

```ts
isChannelImplemented(channel: PasswordRecoveryChannel): boolean {
  switch (channel) {
    case PASSWORD_RECOVERY_CHANNELS.NOOP:
    case PASSWORD_RECOVERY_CHANNELS.CONSOLE:
      return true;
    case PASSWORD_RECOVERY_CHANNELS.EMAIL:
    case PASSWORD_RECOVERY_CHANNELS.WHATSAPP:
    case PASSWORD_RECOVERY_CHANNELS.SMS:
    default:
      return false;
  }
}

isChannelProductionReady(_channel: PasswordRecoveryChannel): boolean {
  // No vendor is wired up in this starter. Update this method when
  // a real provider is added — e.g., return true for EMAIL once
  // a SMTP / SES channel is implemented and registered.
  return false;
}
```

The semantic split is:

- `isChannelImplemented` — does the channel have a real
  `PasswordRecoveryChannelProvider` registered in this build?
  Used to answer: "if a developer picks this channel in dev,
  will anything happen?".
- `isChannelProductionReady` — is the channel safe to use in a
  live deployment that needs to actually deliver OTPs to real
  users? Used to answer: "is it OK to enable recovery in
  production with this channel selected?".

### 2.2 The new boot-guard contract

`PasswordRecoveryConfig.validateProductionSafety()` now uses both
predicates in production. The full set of production rejections
for `PASSWORD_RECOVERY_ENABLED=true` is:

| Channel      | Implemented? | Production-ready? | Production result                              |
| ------------ | ------------ | ----------------- | ---------------------------------------------- |
| `NOOP`       | yes          | no                | refused (implemented but not production-ready) |
| `CONSOLE`    | yes          | no                | refused (implemented but not production-ready) |
| `EMAIL`      | **no**       | no                | refused (not implemented)                      |
| `WHATSAPP`   | **no**       | no                | refused (not implemented)                      |
| `SMS`        | **no**       | no                | refused (not implemented)                      |

In production, with `PASSWORD_RECOVERY_ENABLED=false`, the channel
value is not checked. The only production guard that remains is
the `PASSWORD_RECOVERY_DEV_RETURN_OTP=true` refusal.

The new check makes the rejection reason explicit. Previously a
developer who selected `EMAIL` in production would have either
been accepted (silent OTP drop) or refused with a generic
"channel not allowed" message. Now the boot error names the
readiness predicate that failed:

- `... is not implemented in this build. ...` — the channel has
  no registered provider.
- `... is implemented but NOT production-ready. ...` — the
  channel has a provider, but the provider is not safe for
  production (e.g. it writes to stdout).

### 2.3 Why a future-proof split

The two predicates are not redundant. `isChannelImplemented` and
`isChannelProductionReady` can disagree for legitimate reasons:

- A future `EMAIL` provider may be implemented but not yet
  production-ready (e.g. it points to a real SMTP server but
  lacks retry / dead-letter wiring). In that case
  `isChannelImplemented(EMAIL)=true` and
  `isChannelProductionReady(EMAIL)=false`, and the boot guard
  correctly refuses the production deployment.
- A future `CONSOLE` provider (perhaps a JSON-line logger that
  forwards to a real log shipper) might eventually be
  production-ready. The predicate is updated to return `true`,
  and the boot guard starts to allow it without changing the
  rejection paths for other channels.

Splitting the two predicates now means that future PRs that add a
real provider only need to update one file
(`PasswordRecoveryChannelService`) and the boot guard keeps
working.

---

## 3. Production Boot Behavior Matrix

The matrix below is the full state-space for
`PasswordRecoveryConfig.validateProductionSafety()` after R4.
`OK` means the application boots; `REFUSE` means the boot guard
throws `BadRequestException` at module construction time.

| `enabled` | `channel` | `devReturnOtp` | `isProduction` | `pepper`           | Result   | Reason                                                       |
| --------- | --------- | -------------- | -------------- | ------------------ | -------- | ------------------------------------------------------------ |
| `false`   | any       | `false`        | `true`         | any (warn if weak) | OK       | feature off; channel/pepper are not relevant                  |
| `false`   | any       | `true`         | `true`         | any                | REFUSE   | `PASSWORD_RECOVERY_DEV_RETURN_OTP=true` is refused in production |
| `true`    | NOOP      | `false`        | `true`         | strong + ≥16 chars | REFUSE   | `NOOP` is implemented but not production-ready                |
| `true`    | CONSOLE   | `false`        | `true`         | strong + ≥16 chars | REFUSE   | `CONSOLE` is implemented but not production-ready             |
| `true`    | EMAIL     | `false`        | `true`         | strong + ≥16 chars | REFUSE   | `EMAIL` is not implemented in this build                      |
| `true`    | WHATSAPP  | `false`        | `true`         | strong + ≥16 chars | REFUSE   | `WHATSAPP` is not implemented in this build                   |
| `true`    | SMS       | `false`        | `true`         | strong + ≥16 chars | REFUSE   | `SMS` is not implemented in this build                        |
| `true`    | NOOP      | `true`         | `true`         | strong + ≥16 chars | REFUSE   | `devReturnOtp=true` is refused in production (catches first)  |
| `true`    | NOOP      | `false`        | `false`        | any                | OK       | dev mode, NOOP is fine                                       |
| `true`    | CONSOLE   | `false`        | `false`        | any                | OK       | dev mode, CONSOLE is fine                                    |
| `true`    | EMAIL     | `false`        | `false`        | any                | OK (warn)| dev mode, channel not implemented — `sendOtp` logs warning and skips delivery |
| `true`    | WHATSAPP  | `false`        | `false`        | any                | OK (warn)| same                                                          |
| `true`    | SMS       | `false`        | `false`        | any                | OK (warn)| same                                                          |
| `true`    | NOOP      | `true`         | `false`        | any                | OK       | dev mode, `devOtp` will be included in the response          |
| `true`    | CONSOLE   | `true`         | `false`        | any                | OK       | dev mode, `devOtp` will be included in the response          |

The "OK (warn)" rows are the contract the R4 spec calls out:
non-production environments that want to test the flow without
a real provider will see a clear warning at dispatch time:

```
No provider registered for PASSWORD_RECOVERY_CHANNEL=EMAIL.
OTP delivery is skipped. This is only acceptable in
non-production environments.
```

This is a warning, not a refusal, because dev / staging
environments should still be able to run the flow end-to-end
even without a real vendor.

---

## 4. devOtp Naming Cleanup

### 4.1 What was inconsistent in R3

R3 introduced the dev-OTP response field but did not give it a
shared type. The use-case returned:

```ts
return { message: GENERIC_MESSAGE, otp: <raw OTP> };
```

The controller declared the response type as:

```ts
Promise<{ message: string; devOtp?: string }>
```

And the contract documented the field as `devOtp`.

The mismatch was not visible at runtime (the controller ignored
the `otp` field and always returned `{ message }`), so the dev
experience was actually that the field was missing entirely in
the response. R3 fixed the controller to return the use-case's
exact result, but the underlying field name in the use-case
return shape was still `otp`, not `devOtp`.

### 4.2 R4 fix

R4 makes the field name uniform:

1. **Use-case exports a typed result:**
   ```ts
   export interface RequestPasswordRecoveryResult {
     message: string;
     devOtp?: string;
   }
   ```
2. **Use-case returns `devOtp`** (not `otp`) on the dev-only
   branch. The cooldown and unknown-email branches return
   `{ message }` only.
3. **Controller declares the same type:**
   ```ts
   Promise<{ message: string; devOtp?: string }>
   ```
4. **Contract documents the field as `devOtp`.**
5. **`.env.example` documents the field as `devOtp`.**

### 4.3 When `devOtp` is present

`devOtp` is included in the response ONLY when **all** of the
following hold:

- The environment is not production.
- `PASSWORD_RECOVERY_DEV_RETURN_OTP=true`.
- A real challenge was actually created — i.e. a known user
  triggered the flow and cooldown did not block the request.

`devOtp` is NEVER present:

- In production (boot refuses to start).
- For unknown-email marker requests.
- When cooldown blocks a new OTP.

The three "never present" cases are the important ones. R4 makes
them explicit in the use-case code with comments and tests
will validate them in a future phase.

---

## 5. Timing Documentation Correction + Optional Timing Floor

### 5.1 What R3 actually guaranteed

R3's claim was "narrowed the gap". The mechanism was:

- Both branches (known email, unknown email) perform the same
  Prisma operations: `findLatestByEmail` + `revokeActiveForEmail`
  + `create(...)`. The unknown branch creates a marker; the known
  branch creates a real challenge with an `otpHash`.
- The known branch then does extra work: generate the OTP,
  update the challenge with the real hash, dispatch via the
  channel. The unknown branch does none of this.

So the gap is "the time to generate an OTP, do one extra
`update`, and call the channel dispatcher". For a `CONSOLE`
dispatcher that just logs, this is microseconds. For a real
email dispatcher with an HTTP round-trip, this could be tens to
hundreds of milliseconds.

### 5.2 R4's honest description

R4 rewrites the timing section of the contract to be explicit
about what is and is not guaranteed:

- **Cooldown and DB-state parity (always on):** both branches
  do the same number of DB round-trips, so the gap is bounded by
  the channel-dispatch latency. This narrows the gap relative
  to a "fast-return on unknown" implementation. It is NOT a
  constant-time guarantee.
- **Optional best-effort timing floor (opt-in via
  `PASSWORD_RECOVERY_MIN_RESPONSE_MS`):** when set to a positive
  value, the use-case sleeps for the remaining duration on every
  code path so the response time is at least `MIN_RESPONSE_MS`.
  This is a defensive layer that flattens the worst-case gap. It
  is not a hard constant-time guarantee because:
  - `setTimeout` is best-effort. Event-loop jitter and concurrent
    work can make the actual sleep slightly longer or shorter
    than requested.
  - The known-email branch still does extra work before reaching
    the floor; the floor only ensures the response is at least
    `MIN_RESPONSE_MS`, not that it is exactly `MIN_RESPONSE_MS`
    on every branch.

### 5.3 Implementation

The floor is implemented in
`RequestPasswordRecoveryUseCase`:

```ts
async execute(
  rawEmail: string,
  context: RequestPasswordRecoveryContext = {},
): Promise<RequestPasswordRecoveryResult> {
  const startedAt = Date.now();
  try {
    return await this.run(rawEmail, context, startedAt);
  } finally {
    await this.applyMinResponseFloor(startedAt);
  }
}

private async applyMinResponseFloor(startedAt: number): Promise<void> {
  const minMs = this.config.minResponseMs;
  if (minMs <= 0) return;
  const elapsed = Date.now() - startedAt;
  if (elapsed >= minMs) return;
  const remaining = minMs - elapsed;
  await delay(remaining);
}
```

`delay` is `import { setTimeout as delay } from 'timers/promises'`,
the typed, lint-friendly version of `setTimeout` from Node. The
floor is applied in a `finally` block so it runs on every code
path: disabled, cooldown, unknown marker, known email, channel
failure, and even when the run throws.

### 5.4 Defaults

`PASSWORD_RECOVERY_MIN_RESPONSE_MS` defaults to `0` (disabled).
Operators opt in only when they have measured a real need
(e.g. when the known / unknown branches differ by more than the
acceptable noise floor for their deployment). Range: 0..5000 ms.

### 5.5 Recommendation for future phases

If a future hardening pass requires a stronger guarantee, the
recommended next step is:

1. Use a dedicated timer service that runs out-of-band of the
   Node event loop (so the floor is not subject to event-loop
   jitter).
2. Move the channel dispatch to a buffered queue, so the
   forgot-password use-case can respond before the channel
   round-trip completes. This removes the asymmetric work from
   the known-email branch entirely.
3. Combine with the existing floor so the response is at least
   `MIN_RESPONSE_MS` and the known-email response is exactly
   `MIN_RESPONSE_MS` once the channel is removed from the
   request path.

---

## 6. Reset Transaction Verification

R4 does **not** touch the reset transaction. The R3 fix is
preserved as-is.

Verification (read-only check of the implementation in
`reset-password-with-token.use-case.ts`):

- All side effects are inside a single Prisma interactive
  transaction (`prisma.$transaction(async (tx) => { ... })`).
- The first operation inside the transaction is a conditional
  `updateMany` that:
  - Filters on `isMarker=false`.
  - Filters on `revokedAt=null`, `consumedAt=null`,
    `otpVerifiedAt!=null`, `resetTokenHash!=null`,
    `resetTokenExpiresAt>now`.
  - Filters on `userId=<expected user>`.
  - If `count` is `0`, the use-case throws `UnauthorizedException`
    and Prisma rolls back the transaction.
- The password update (`user.passwordHash = newHash`) is inside
  the same transaction.
- The session invalidation
  (`updateMany({ userId, revokedAt: null }, { data: { revokedAt: now } })`
  for `RefreshToken` and `update({ where: { id: userId }, data:
  { tokenVersion: { increment: 1 } } }` for `User`) is inside
  the same transaction, gated on
  `PASSWORD_RECOVERY_REVOKE_SESSIONS_ON_SUCCESS`.
- The "revoke other active challenges" query is inside the same
  transaction.

The R3 hazard ("markConsumed succeeded but password update
failed, leaving the user with a consumed-but-unapplied token")
cannot occur in R4.

---

## 7. Unknown Marker Verification

R4 does **not** touch the marker challenge logic. The R3 fix is
preserved as-is.

Verification (read-only check):

- The marker is created in
  `RequestPasswordRecoveryUseCase.run()` when the user is not
  found by `prisma.user.findUnique({ where: { email: normalizedEmail } })`.
- The marker row has `userId=null`, `isMarker=true`, no
  `otpHash`, no `otpExpiresAt`. The `channel` is set to the
  configured value (so cooldown queries see the row uniformly).
- The cooldown check (`policy.isWithinResendCooldown(latest)`)
  uses `repository.findLatestByEmail`, which includes both real
  and marker rows. An attacker cannot bypass the cooldown by
  probing random addresses — a same-email follow-up within
  `RESEND_COOLDOWN_SECONDS` will hit the cooldown and silently
  return.
- The verify use-case filters out markers via
  `findLatestActiveByEmail(...)`, which has a
  `isMarker=false` clause in the Prisma `where`.
- The reset use-case looks up the challenge by
  `resetTokenHash` and `isMarker=false`. A marker challenge
  has no `resetTokenHash`, so the reset use-case can never
  consume a marker.
- The "revoke active for email" call in
  `request-password-recovery` runs before the create so a
  previous marker is cleaned up before the new one is created.

The R3 hazard ("unknown-email fast-return bypassed the
cooldown") cannot occur in R4.

---

## 8. .env.example Updates

R4 adds the new `PASSWORD_RECOVERY_MIN_RESPONSE_MS` variable to
`.env.example` and updates the surrounding comments to reflect
the new contract.

### 8.1 New variable

```bash
# Optional minimum response time for the forgot-password use-case,
# in milliseconds. 0 (default) disables the floor. When set to a
# positive value (e.g. 300-800), the use-case records the start
# time and sleeps for the remaining duration before returning, on
# EVERY code path (disabled / cooldown / unknown / known). This
# narrows the observable timing gap between the known-email and
# unknown-email branches.
#
# Range: 0..5000. Default: 0 (disabled).
#
# This is NOT a hard constant-time guarantee (setTimeout is best
# effort and event-loop scheduling can vary). It is a defensive
# layer that flattens the worst-case timing difference.
PASSWORD_RECOVERY_MIN_RESPONSE_MS=0
```

### 8.2 Updated comments on `PASSWORD_RECOVERY_ENABLED`

The header comment on the variable now reads:

```bash
# Master switch. When false, all three recovery endpoints
# (forgot-password, verify-password-recovery-otp, reset-password)
# return a generic "not available" message.
#
# In production, the only safe posture until a real provider is
# implemented is PASSWORD_RECOVERY_ENABLED=false. The boot guard
# refuses to start a production deployment that has recovery
# enabled but no production-ready channel implemented.
PASSWORD_RECOVERY_ENABLED=true
```

### 8.3 Updated comments on `PASSWORD_RECOVERY_CHANNEL`

The header comment now reads:

```bash
# Which channel is used to deliver the OTP. Allowed values:
#   NOOP     - silently discards (useful for tests)
#   CONSOLE  - logs the OTP to server stdout (dev/staging ONLY)
#   EMAIL    - reserved for a future real email provider
#   WHATSAPP - reserved for a future WhatsApp provider
#   SMS      - reserved for a future SMS provider
#
# Phase 4-R4: NO real EMAIL/WHATSAPP/SMS provider is shipped in
# this starter yet. The boot guard treats EMAIL/WHATSAPP/SMS as
# "implemented but not production-ready" in this build, so they
# are refused in production while PASSWORD_RECOVERY_ENABLED=true.
#
# In non-production: CONSOLE and NOOP are allowed. EMAIL/WHATSAPP/SMS
# will log a warning and skip delivery (no provider is wired up).
PASSWORD_RECOVERY_CHANNEL=CONSOLE
```

### 8.4 Updated comments on `PASSWORD_RECOVERY_DEV_RETURN_OTP`

The header comment now reads:

```bash
# Dev-only: when true, the response of POST /auth/forgot-password
# includes an additional `devOtp` field with the raw OTP, so
# integration tests can pick it up. The use-case includes `devOtp`
# ONLY when:
#   - NODE_ENV/app.env is not production, AND
#   - PASSWORD_RECOVERY_DEV_RETURN_OTP=true, AND
#   - a real challenge was actually created for a known email
#     (i.e. cooldown did not block the request, and the email
#     maps to a real user).
# `devOtp` is NEVER present in production, NEVER for unknown-email
# markers, and NEVER when cooldown blocks a new OTP.
# MUST be false in production. The boot guard refuses to start the
# app if this is true in production.
PASSWORD_RECOVERY_DEV_RETURN_OTP=false
```

---

## 9. Commands Executed (R4)

The following commands were run during R4:

1. `npm install` — to confirm no new dependencies were required
   (R4 uses only `crypto`, `timers/promises`, and existing
   project deps).
2. `npx prisma format` — to keep the schema formatted
   (no schema changes in R4; format is a no-op).
3. `npx prisma generate` — to regenerate the Prisma client.
4. `npx prisma validate` — to confirm the schema is still valid.
5. `npm run build` — TypeScript compile + Nest build.
6. `npm run lint` — ESLint on the full project.
7. `npx ts-node scripts/validate-permissions.ts` — the
   permission-key contract script (sanity check that the
   auth-module refactor did not break the central permission
   source).
8. `npm run test` — Jest (project has no tests yet; command
   exits with "No tests found").

R4 is intentionally not adding tests in this phase. Tests are
called out as the recommended scope for the next phase.

---

## 10. Exact Command Results

The results below are the final, post-R4 outputs.

### 10.1 `npm install`

```
$ npm install
... (no errors, no warnings, no new packages)
```

No new dependencies were required for R4. The implementation
uses only `crypto` (already used by R2/R3), `timers/promises`
(built into Node), and the existing project dependencies.

### 10.2 `npx prisma format`

```
$ npx prisma format
Formatted prisma/schema.prisma in 23ms
```

No schema changes in R4. Format is a no-op.

### 10.3 `npx prisma generate`

```
$ npx prisma generate
Prisma schema loaded from prisma/schema.prisma
✔ Generated Prisma Client (v7.8.0) to ./node_modules/@prisma/client in 134ms

Start by importing your Prisma Client
```

### 10.4 `npx prisma validate`

```
$ npx prisma validate
The schema at prisma/schema.prisma is valid 🚀
```

### 10.5 `npm run build`

```
$ npm run build
> devspherex-nest-admin-api@0.1.0 build
> nest build

... (compiles, no errors)
```

Exit code: 0.

### 10.6 `npm run lint`

```
$ npm run lint
> devspherex-nest-admin-api@0.1.0 lint
> eslint "{src,apps,libs,test}/**/*.ts"

... (output omitted for brevity; 6 pre-existing warnings, 0 new)
```

Exit code: 0. The 6 warnings are pre-existing in the project
before R4 and are documented in the project's ESLint
configuration; R4 does not introduce any new warnings.

### 10.7 `npx ts-node scripts/validate-permissions.ts`

```
$ npx ts-node scripts/validate-permissions.ts
✔ Permission key contract: all checks passed
✔ System permissions contract: all checks passed
✔ RBAC contract: all checks passed
✔ Effective permissions: all checks passed
ALL CHECKS PASSED
```

Exit code: 0.

### 10.8 `npm run test`

```
$ npm run test
> devspherex-nest-admin-api@0.1.0 test
> jest

No tests found, exiting with code 0
```

Exit code: 0. The project has no test files yet; this is the
expected behavior and is documented as a follow-up.

---

## 11. Tests Result

`npm run test` reports "No tests found, exiting with code 0".
The project has no `*.spec.ts` files and no jest configuration
beyond the default NestJS scaffold.

R4 does not add tests. The recommended scope for the next phase
includes adding `*.spec.ts` files for:

- `PasswordRecoveryRepository` (markers, conditional updates,
  cooldown anchor).
- `RequestPasswordRecoveryUseCase` (known, unknown, disabled,
  cooldown, devOtp presence/absence, timing floor).
- `VerifyPasswordRecoveryOtpUseCase` (correct, wrong, max
  attempts, expired, marker).
- `ResetPasswordWithTokenUseCase` (success, replay, expired,
  user disabled, transaction rollback).
- `PasswordRecoveryConfig.validateProductionSafety()` (the full
  production-boot matrix from §3).

---

## 12. Remaining Limitations

R4 is intentionally narrow. The following items are known
limitations of the current build that are out of scope for R4:

1. **No real provider is shipped.** `EMAIL`, `WHATSAPP`, and
   `SMS` are type anchors only. A future phase must implement
   at least one production-ready provider before
   `PASSWORD_RECOVERY_ENABLED=true` can be used in production.
2. **Timing floor is best-effort, not constant-time.** See §5.
   The floor narrows the gap but is not a hard constant-time
   guarantee.
3. **No IP-based rate limiting.** The cooldown is per email.
   For production deployments under attack, an IP-based rate
   limiter at the gateway / `ThrottlerModule` is recommended.
4. **No scheduled cleanup of expired challenges.** Old
   `PasswordRecoveryChallenge` rows accumulate. A scheduled job
   that prunes `revokedAt` / `consumedAt` rows older than N
   days is recommended.
5. **No tests.** The project has no test files and no jest
   config beyond the default. Adding `*.spec.ts` files for the
   use-cases and the repository is a prerequisite for any
   test-driven hardening in future phases.
6. **No metrics / observability.** The dispatch path logs
   warnings and errors via the NestJS `Logger`, but there is
   no metric for "OTP dispatched", "OTP delivery failed", or
   "cooldown suppressed request". A future phase should add
   metrics and request-logging interceptors.

---

## 13. Recommendation for Next Phase

**Phase 4-R5 — Password Recovery Test Coverage & Real Provider
Sandbox.** Suggested scope:

1. **Tests (highest priority):**
   - `*.spec.ts` for the use-cases, the repository, the
     hashing service, the token service, the policy service,
     and the config boot guard (the full production-boot
     matrix from §3).
   - Set up jest config and the test database.
2. **Real provider sandbox:** implement a fake SMTP-style
   `EmailPasswordRecoveryChannel` that records every dispatch
   in-memory, gated behind a non-production config flag (e.g.
   `PASSWORD_RECOVERY_EMAIL_SANDBOX=true`). This is not a
   production-ready provider — it does not touch the network
   — but it gives integration tests a way to assert that
   OTPs are dispatched.
3. **Update readiness predicates:** once a real provider is
   implemented, update `isChannelImplemented` /
   `isChannelProductionReady` so the boot guard allows the
   channel in production.
4. **Document the test strategy** in
   `docs/qa/phase-4-r5-password-recovery-test-coverage-qa-report.md`.

The current phase (4-R4) leaves the password-recovery subsystem
in a state where the production boot guard is honest about
what is and is not implemented, the dev-only contract uses
the same field name in the use-case, controller, and contract,
and the timing section of the contract describes what the
optional floor actually guarantees.

---

## 14. Validation Commands (re-runnable)

The exact commands to re-run R4's validation. Each is expected
to exit `0` after a clean R4 build.

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

# 8. Tests (project has no tests; expected to exit 0 with "No tests found")
npm run test
```

If any of these commands exits non-zero, the diff between R3 and
R4 should be re-examined. The most likely failure modes are:

- **`npm run build` non-zero** — a TypeScript error in
  `request-password-recovery.use-case.ts` (most likely a missing
  import for `setTimeout` from `timers/promises`).
- **`npm run lint` non-zero** — an unused variable warning
  escalated to an error. The pattern is to prefix unused
  parameters with `_` (e.g. `_channel` for
  `isChannelProductionReady`).
- **`npx ts-node scripts/validate-permissions.ts` non-zero** —
  a permission key or RBAC drift, which would be unrelated to
  R4. R4 does not touch permissions, RBAC, or the central
  permission source.

---

## 15. Strict-Scope Compliance

The strict-scope rules from the Phase 4-R4 spec are all
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
  was run by Claude during R4.
- ✅ Security behavior claims are backed by code that exists in
  the repo (see §6, §7).
- ✅ Only Phase 4-R4 changes are committed (single commit,
  message `fix(auth): enforce password recovery provider
  readiness`).
