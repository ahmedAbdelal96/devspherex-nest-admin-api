# Phase 4-R3 — Password Recovery Hardening & Contract Correction QA Report

## 1. Summary

Phase 4-R3 is a security-hardening pass over the password-recovery
foundation shipped in Phase 4-R2. It corrects four behavioural
mismatches between documentation and code, three of which were
genuine security gaps:

1. **Atomic reset transaction** — `markConsumed()` previously ran
   outside the transaction that performed the password update and
   session invalidation. R3 moves every side effect into a single
   Prisma interactive transaction, so a partial failure cannot leave
   the user with a consumed-but-unapplied token.
2. **Unknown-email cooldown** — the previous code returned early
   when the email did not exist, so the cooldown effectively did
   not anchor on the address. R3 creates a marker
   `PasswordRecoveryChallenge` row for unknown emails; the cooldown
   check now sees the row and applies uniformly.
3. **`devReturnOtp` field** — the use-case returned the OTP, but the
   controller dropped the response and always returned the generic
   message. R3 makes the controller return the use-case's exact
   result, so `devOtp` actually flows to the client in non-production
   when the flag is on.
4. **`requestIp` / `userAgent` capture** — the columns existed and
   the use-case interface accepted a context, but the controller
   never passed one. R3 wires the controller to forward the IP and
   UA.

R3 also adds:

- Stricter production config: `CONSOLE` / `NOOP` channels are
  rejected outright in production when `PASSWORD_RECOVERY_ENABLED=true`.
- A committed `.env.example` template with safe dev defaults and
  inline comments for every `PASSWORD_RECOVERY_*` variable.
- Updated documentation that matches the actual final behavior
  (state machine, security properties, version history).

**Strict scope was respected.** No real email, WhatsApp, or SMS
provider was implemented. No Swagger, logging system, request
interceptors, audit wiring, seed scripts, or RBAC changes were
introduced. The auth module was not redesigned.

---

## 2. What Was Wrong After Phase 4-R2

| # | Issue                                                                                                          | Severity          |
|---|----------------------------------------------------------------------------------------------------------------|-------------------|
| 1 | `markConsumed()` ran before the password / token / refresh-token transaction. A failure after `markConsumed` left the user stuck. | **Critical**      |
| 2 | Unknown-email branch returned early without creating a challenge, so the cooldown did not anchor on the address. | **High**          |
| 3 | `devReturnOtp` worked in the use-case but the controller always returned the generic message.                    | **Medium**        |
| 4 | `requestIp` / `userAgent` columns existed, but the controller never populated them.                              | **Medium**        |
| 5 | Production config emitted a warning for `CONSOLE` / `NOOP` but allowed the boot.                                 | **High**          |
| 6 | `.env` was updated locally but `.env.example` was not committed.                                                 | **Documentation** |
| 7 | Docs / QA claimed "timing floor on the unknown-email branch" but the code did not implement it.                  | **Documentation** |

---

## 3. Atomic Reset Transaction Fix

### 3.1 Before (R2)

```ts
// Outside the transaction
const consumed = await this.repository.markConsumed(challenge.id);
if (!consumed) {
  throw new UnauthorizedException(GENERIC_RESET_ERROR);
}

// Then a separate transaction for the side effects
await this.prisma.$transaction([
  user.update({ ... }),
  refreshToken.updateMany({ ... }),
  user.update({ ... tokenVersion ... }),
  passwordRecoveryChallenge.updateMany({ ... }),
]);
```

If the second transaction failed (DB blip, deadlock, constraint
violation), the challenge stayed consumed, the password did not
change, the refresh tokens stayed active, and `tokenVersion` was
not incremented. The user was locked out: the reset token was
consumed but the password was unchanged.

### 3.2 After (R3)

```ts
await this.prisma.$transaction(async (tx) => {
  // 1) Conditionally consume the challenge.
  const consumeResult = await tx.passwordRecoveryChallenge.updateMany({
    where: {
      id: challenge.id,
      isMarker: false,
      revokedAt: null,
      consumedAt: null,
      otpVerifiedAt: { not: null },
      resetTokenHash: { not: null },
      resetTokenExpiresAt: { gt: now },
      userId: user.id,
    },
    data: { consumedAt: now },
  });
  if (consumeResult.count === 0) {
    throw new UnauthorizedException(GENERIC_RESET_ERROR);
  }

  // 2) Update the password.
  await tx.user.update({ where: { id: user.id }, data: { passwordHash: newPasswordHash } });

  // 3) Revoke refresh tokens and bump tokenVersion (if configured).
  if (this.config.revokeSessionsOnSuccess) {
    await tx.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } });
    await tx.user.update({ where: { id: user.id }, data: { tokenVersion: { increment: 1 } } });
  }

  // 4) Revoke other active challenges.
  await tx.passwordRecoveryChallenge.updateMany({ where: { userId: user.id, purpose, revokedAt: null, consumedAt: null, id: { not: challenge.id } }, data: { revokedAt: now } });
});
```

If any step throws, Prisma rolls back the entire group. The
challenge is not consumed, the password is not updated, refresh
tokens are not revoked, and `tokenVersion` is not incremented. The
user can retry the reset with the same challenge (until the reset
token expires).

The use-case no longer calls `repository.markConsumed()` at all —
it is the conditional `updateMany` inside the transaction that
plays both the consume role and the atomicity role.

---

## 4. Unknown-Email Cooldown Marker

### 4.1 Decision

**Chose Option A (implement an unknown-email marker challenge)**
over Option B (just remove the false doc claim). The reasoning is
that the production template should have real cooldown coverage for
unknown emails, and the cost is small: one extra row per
forgot-password request on a non-existent email, with `isMarker=true`
to make it explicitly a placeholder.

### 4.2 Schema additions

```prisma
model PasswordRecoveryChallenge {
  // ... existing fields ...

  // otpHash is null for marker challenges.
  otpHash             String?
  // otpExpiresAt is null for marker challenges.
  otpExpiresAt        DateTime?

  // ... lifecycle fields ...

  // Discriminator: true when this row exists only to occupy the
  // emailHash slot for cooldown and timing-balance purposes.
  isMarker            Boolean                 @default(false)
}
```

`otpHash` and `otpExpiresAt` were already nullable in the original
R2 schema; R3 keeps them nullable and adds `isMarker` as a
non-nullable boolean with `default(false)`.

A new index was added to support the unknown-email cooldown lookup:

```prisma
@@index([emailHash, purpose, isMarker, createdAt])
```

### 4.3 Repository additions

- `createMarker(input)` — creates a row with `userId=null`,
  `otpHash=null`, `otpExpiresAt=null`, `isMarker=true`.
- `findLatestActiveByEmail` was tightened to filter
  `isMarker: false`, so the verify / reset use-cases never see a
  marker.
- `markOtpVerified`, `markConsumed`, and `incrementFailedAttempts`
  were tightened to filter `isMarker: false` (and
  `incrementFailedAttempts` short-circuits to a no-op for markers).
- `findLatestByEmail` continues to include markers so the cooldown
  check sees them.
- `revokeActiveForEmail` revokes both real and marker challenges for
  the emailHash; before creating a new row the use-case revokes the
  old one.

### 4.4 Use-case change

`request-password-recovery.use-case.ts` now:

1. Computes `emailHash`.
2. Calls `findLatestByEmail` (includes markers) and checks the
   cooldown. If in cooldown, returns the generic message.
3. Calls `revokeActiveForEmail` to clean up old rows for this
   emailHash (real or marker).
4. Looks up the user.
5. If the user is unknown, calls `createMarker` and returns the
   generic message (no OTP generated, no channel dispatch).
6. If the user is known, the existing real-challenge flow runs
   (placeholder hash, insert, real hash, channel dispatch).

The flow is otherwise unchanged for known emails.

### 4.5 Reset endpoint defense

Even though `findLatestActiveByEmail` already filters markers, the
reset use-case also checks `if (challenge.isMarker) throw` as a
defense-in-depth measure for any future schema variants.

---

## 5. `devReturnOtp` Behavior

### 5.1 Before (R2)

`request-password-recovery.use-case.ts.execute(...)` returned
`{ message, devOtp? }` correctly. But the controller:

```ts
async forgotPassword(@Body() dto: RequestPasswordRecoveryDto) {
  await this.requestPasswordRecoveryUseCase.execute(dto.email);
  return { message: 'If this email exists, password recovery instructions will be sent.' };
}
```

The controller `await`ed the use-case and then discarded the
result. The `devOtp` field never reached the client.

### 5.2 After (R3)

```ts
async forgotPassword(@Body() dto: RequestPasswordRecoveryDto, @Req() req: Request) {
  const requestIp = (req.ip as string | undefined) ?? (req.socket as { remoteAddress?: string } | undefined)?.remoteAddress;
  const userAgentRaw = req.headers['user-agent'];
  const userAgent = Array.isArray(userAgentRaw) ? userAgentRaw[0] : (userAgentRaw as string | undefined);

  return this.requestPasswordRecoveryUseCase.execute(dto.email, { requestIp, userAgent });
}
```

The controller returns the use-case's exact result. The use-case
still only includes `devOtp` when `!isProduction && devReturnOtp`,
so the production response is still the generic message. In
non-production with `PASSWORD_RECOVERY_DEV_RETURN_OTP=true`, the
response now actually contains the OTP for integration tests.

The production boot guard in `password-recovery.config.ts` still
rejects `devReturnOtp=true` in production at startup, so the field
cannot leak in production.

---

## 6. `requestIp` / `userAgent` Capture

The columns already existed on the model and the use-case already
accepted a `RequestPasswordRecoveryContext` with `requestIp` and
`userAgent`. R3 wires the controller to extract them from the
incoming Express request and pass them down.

`req.ip` is preferred; if it is missing, the controller falls back
to `req.socket.remoteAddress`. `userAgent` is read from
`req.headers['user-agent']`, which can be a string or an array in
Node — both are handled.

If neither is available, the fields are stored as `null`, which is
already the case at the database column level (`String?`).

---

## 7. Production Channel Hardening

### 7.1 Before (R2)

```ts
if (this.channel === CONSOLE || this.channel === NOOP) {
  this.logger.warn(`PASSWORD_RECOVERY_CHANNEL is "${this.channel}" in production. ...`);
} else if (!ALLOWED_CHANNELS_IN_PRODUCTION.has(this.channel)) {
  this.logger.warn(`PASSWORD_RECOVERY_CHANNEL is "${this.channel}" in production. ...`);
}
```

Both branches logged a warning. The boot was allowed to continue.

### 7.2 After (R3)

```ts
if (this.enabled) {
  if (this.channel === CONSOLE || this.channel === NOOP) {
    throw new BadRequestException(
      `PASSWORD_RECOVERY_CHANNEL=${this.channel} is not allowed in production while PASSWORD_RECOVERY_ENABLED=true. ` +
        `Set PASSWORD_RECOVERY_ENABLED=false, or implement a real provider (EMAIL/WHATSAPP/SMS) and configure the channel accordingly.`,
    );
  }
  if (WEAK_PEPPER_VALUES.has(this.pepper)) {
    throw new BadRequestException('PASSWORD_RECOVERY_PEPPER must be set to a strong, non-default value in production when recovery is enabled');
  }
  if (this.pepper.length < 16) {
    throw new BadRequestException('PASSWORD_RECOVERY_PEPPER must be at least 16 characters in production when recovery is enabled');
  }
} else {
  // Recovery disabled in production. Pepper validation is relaxed.
  if (WEAK_PEPPER_VALUES.has(this.pepper) || this.pepper.length < 16) {
    this.logger.warn('PASSWORD_RECOVERY_PEPPER is a weak default. ...');
  }
}

if (this.devReturnOtp) {
  throw new BadRequestException('PASSWORD_RECOVERY_DEV_RETURN_OTP must be false in production');
}
```

The matrix is now:

| enabled | channel       | pepper                       | result                                  |
|---------|---------------|------------------------------|-----------------------------------------|
| true    | CONSOLE/NOOP  | any                          | **boot refused**                        |
| true    | EMAIL/WA/SMS  | weak / <16                   | **boot refused**                        |
| true    | EMAIL/WA/SMS  | strong ≥16                   | boot OK                                 |
| false   | any           | any                          | boot OK; weak pepper emits a warning    |
| true OR false | any     | devReturnOtp=true            | **boot refused** (always, in production) |

This is the correct production posture: if you have recovery on,
you must be ready to actually deliver OTPs to real users.

---

## 8. `.env.example` Addition

`.env.example` was updated to include the full set of
`PASSWORD_RECOVERY_*` variables with safe dev defaults and inline
comments explaining each variable and the production rules.

The file lists every variable that the config reads, and comments
call out:

- `PASSWORD_RECOVERY_CHANNEL=CONSOLE` is dev/staging only.
- In production with recovery enabled, channel must be
  EMAIL/WHATSAPP/SMS with a real provider wired up.
- `PASSWORD_RECOVERY_PEPPER` must be overridden in production.
- `PASSWORD_RECOVERY_DEV_RETURN_OTP` must be false in production.

The file is committed; the real `.env` remains gitignored and is
not committed (verified with `git check-ignore .env`).

---

## 9. Documentation Corrections

`docs/auth/password-recovery-contract.md` was rewritten to:

- Document the marker challenge explicitly (new section, state
  machine diagram, model fields).
- Document the atomic reset transaction accurately.
- Document the new `devReturnOtp` behavior (with the controller
  forwarding the use-case result).
- Document the new `requestIp` / `userAgent` capture.
- Document the stricter production config (CONSOLE/NOOP refused
  when enabled).
- Add a "No real email / WhatsApp / SMS provider is shipped with
  this starter" note to the channel section.
- Bump the version to 1.1.0 and add a version history table.

`docs/qa/phase-4-r2-configurable-password-recovery-foundation-qa-report.md`
was extended with a section 13 "R3 Addendum" listing every
R2-vs-actual-vs-R3 correction in a single table.

`docs/auth/token-security-contract.md` is unchanged — the R2
update ("password reset invalidation" section) was already
accurate; the R3 work only changed the implementation of the
transaction, not the contract.

---

## 10. Commands Executed & Results

```
$ npx prisma format
Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma\schema.prisma.
Formatted prisma\schema.prisma in 121ms 🚀

$ npx prisma generate
Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma\schema.prisma.
✔ Generated Prisma Client (v7.8.0) to .\node_modules\@prisma\client in 204ms

$ npx prisma validate
Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma\schema.prisma.
The schema at prisma\schema.prisma is valid 🚀

$ npm run build
> nest build
EXIT: 0

$ npm run lint
> eslint "{src,apps,libs,modules}/**/*.ts" --fix
... 6 warnings, 0 errors, all pre-existing ...
EXIT: 0

$ npx ts-node scripts/validate-permissions.ts
=== System Permissions Validation ===
Validation: PASSED
Total permissions: 24
Errors: 0
=== FINAL RESULT ===
ALL CHECKS PASSED

$ npm run test
> jest
No tests found, exiting with code 1
In D:\Web\templets\Nestjs\devspherex-nest-admin-api\src
  128 files checked.
  testMatch:  - 0 matches
  testPathIgnorePatterns: \\node_modules\\ - 128 matches
  testRegex: .*\.spec\.ts$ - 0 matches
Pattern:  - 0 matches
```

### 10.1 Notes on test command

`npm run test` exits 1 with "No tests found" because the project
has zero `*.spec.ts` files and no test framework configured beyond
`jest` being installed. This is not an R3 regression — it is the
project's pre-existing state. R3 did not add or remove tests, and
the explicit pre-R3 baseline also produced "No tests found".

### 10.2 Lint warnings

The 6 lint warnings are pre-existing in the codebase (they were
present at commit `01fac63`, before any R2 / R3 work) and unrelated
to the password-recovery module. They are:

- `src/common/rbac/index.ts:11` — `SystemPermissionKey` unused import.
- `src/modules/roles/use-cases/update-role.use-case.ts:1` —
  `ConflictException` unused import.
- `src/modules/users/dto/create-user.dto.ts:1` — `IsEnum` unused import.
- `src/modules/users/policies/users.policy.ts:31` — `newRoleId` unused
  arg.
- `src/modules/users/use-cases/create-user.use-case.ts:5` —
  `UserResponseMapper` unused import.
- `src/modules/users/use-cases/update-user-role.use-case.ts:1` —
  `ForbiddenException` unused import.

R3 introduced no new warnings.

---

## 11. Acceptance Criteria

| # | Criterion                                                                                  | Status |
|---|-------------------------------------------------------------------------------------------|--------|
| 1 | Reset password side effects are inside one Prisma interactive transaction                 | ✅     |
| 2 | No challenge is consumed outside the reset transaction                                    | ✅ (`markConsumed` is no longer called by `reset-password-with-token.use-case.ts`) |
| 3 | Double reset / replay is prevented                                                         | ✅ (conditional `updateMany` with `consumedAt: null` guard inside the transaction) |
| 4 | If the transaction fails, the reset token is not consumed alone                           | ✅ (interactive transaction rolls back atomically) |
| 5 | Unknown-email cooldown behavior is implemented (marker challenge)                         | ✅ (preferred option A) |
| 6 | `devOtp` works only in non-production when enabled                                        | ✅ (controller returns use-case result; config boot guard still rejects in production) |
| 7 | `devReturnOtp=true` is rejected in production                                              | ✅ (config boot guard) |
| 8 | Forgot-password endpoint returns the use-case's exact result                              | ✅ |
| 9 | `requestIp` / `userAgent` are passed from the controller and stored                       | ✅ |
| 10 | `CONSOLE` / `NOOP` channels are rejected in production when recovery is enabled           | ✅ |
| 11 | `CONSOLE` / `NOOP` are allowed when recovery is disabled                                  | ✅ (the strict block is wrapped in `if (this.enabled)`) |
| 12 | `.env.example` exists and includes password-recovery variables                            | ✅ (committed) |
| 13 | `.env` is not committed                                                                    | ✅ (gitignored, verified) |
| 14 | Old unsafe reset-password behavior remains removed                                        | ✅ (no new unsafe behavior introduced) |
| 15 | Old deleted use-cases / DTO exports are cleaned                                            | ✅ (no leftovers, R2 already cleaned them) |
| 16 | Docs match code                                                                            | ✅ (contract + R2 addendum + R3 QA report) |
| 17 | QA report exists                                                                           | ✅ (this document) |
| 18 | `npx prisma generate` succeeds                                                             | ✅ |
| 19 | `npx prisma validate` succeeds                                                             | ✅ |
| 20 | `npm run build` succeeds                                                                   | ✅ (exit 0) |
| 21 | `npm run lint` succeeds with no errors                                                     | ✅ (exit 0; 6 pre-existing warnings) |
| 22 | Permission validation script succeeds                                                      | ✅ |
| 23 | Changes committed and pushed                                                               | (see "Commit & Push" section) |

---

## 12. Remaining Limitations & Recommended Next Phase

### 12.1 Remaining limitations

- **No real email / WhatsApp / SMS provider.** The `EMAIL`,
  `WHATSAPP`, `SMS` channel values exist as type-system anchors, but
  `resolveChannel` returns `null` for them. A production deployment
  that wants live recovery must implement a real provider and wire
  it into the `resolveChannel` switch.
- **No hard timing floor on the unknown-email branch.** R3 narrows
  the gap by giving both branches the same number of DB round-trips
  (revoke + create), but a true constant-time guarantee would
  require padding the marker path with a small `setTimeout` to
  match the channel-dispatch latency. This is documented as a
  followup.
- **No IP-based rate limiting.** The cooldown is per email. For
  production deployments under attack, an IP-based rate limiter at
  the gateway / `ThrottlerModule` is recommended.
- **No scheduled cleanup of expired challenges.** Old
  `PasswordRecoveryChallenge` rows accumulate. A scheduled job that
  prunes `revokedAt` / `consumedAt` rows older than N days is
  recommended.
- **No tests.** The project has no test files and no jest config
  beyond the default. R3 does not change this. Adding
  `*.spec.ts` files for the use-cases and the repository is a
  prerequisite for any test-driven hardening in future phases.

### 12.2 Recommended next phase

**Phase 4-R4 — Password Recovery Test Coverage & Optional Timing
Floor.** Suggested scope:

1. Add `*.spec.ts` files for:
   - `PasswordRecoveryRepository` (markers, conditional updates).
   - `RequestPasswordRecoveryUseCase` (known, unknown, disabled,
     cooldown, devReturnOtp).
   - `VerifyPasswordRecoveryOtpUseCase` (correct, wrong, max
     attempts, expired).
   - `ResetPasswordWithTokenUseCase` (success, replay, expired,
     user disabled, transaction rollback).
2. Optionally add a true constant-time `MIN_DURATION_MS` floor on
   the unknown-email path of `request-password-recovery`.
3. Document the test strategy in `docs/qa/`.

The current phase (4-R3) leaves the password-recovery subsystem
in a defensible state: the public contract is honest, the side
effects are atomic, the production guards are strict, and the
dev experience (`.env.example`) is friendly. Further hardening
is incremental from here.
