# Phase 7-A-R1 — Audit Contract Completion

**Date:** 2026-06-10
**Status:** ✅ Complete
**Commit:** `fix(audit): complete audit contract context and snapshots`

---

## What Was Wrong After Phase 7-A (e325cf9)

Phase 7-A established the audit logging foundation but the contract was incomplete:

1. **Schema mismatch** — AuditLog used `entity`/`entityId`/`ip` instead of `resourceType`/`resourceId`/`ipAddress`. No `status`, no `actorEmail`, no `actorRoleId`.
2. **before/after collapsed** — AuditLogService stored `before`, `after`, `metadata` as one `metadata` field via `sanitizedMetadata ?? sanitizedAfter ?? sanitizedBefore`. No real separation.
3. **Mapper fake nulls** — `toAuditLogResponse()` always returned `before: null`, `after: log.metadata`, `metadata: null`. Not a real audit contract.
4. **No request context** — audit calls in controllers had no `requestId`, `ipAddress`, or `userAgent`. The Phase 6 `requestIdMiddleware` foundation was not connected.
5. **Filters incomplete** — `requestId` and `status` filters existed in DTO but not wired into the repository's `findAll`. `resourceType`/`resourceId` vs `entity`/`entityId` naming was inconsistent.
6. **ResetPasswordWithTokenUseCase** — audit call had no request context (no `Req()` injection at use-case level).

---

## Changes Made

### 1. Schema Update (prisma/schema.prisma)

Renamed `AuditLog` fields to match the required contract:

| Old Name | New Name | Notes |
|---|---|---|
| `entity` | `resourceType` | Cleaner naming |
| `entityId` | `resourceId` | Cleaner naming |
| `ip` | `ipAddress` | Consistent naming |
| — | `status` | Added, defaults to `SUCCESS` |
| — | `actorEmail` | Added for actor email capture |
| — | `actorRoleId` | Added for actor role capture |
| — | `before` | Added Json field |
| — | `after` | Added Json field |

Removed old `metadata`-only design in favor of `before`/`after`/`metadata` as three separate fields.

### 2. AuditLogService (audit-log.service.ts)

Updated to pass all fields separately to repository:

```typescript
await this.auditLogsRepository.create({
  actorId: input.actor?.id,
  actorEmail: input.actor?.email,
  actorRoleId: input.actor?.roleId,
  action: input.action,
  resourceType: input.resourceType,
  resourceId: input.resourceId,
  status: input.status ?? 'SUCCESS',
  requestId: input.request?.requestId,
  ipAddress: input.request?.ipAddress,
  userAgent: input.request?.userAgent,
  before: sanitizedBefore,
  after: sanitizedAfter,
  metadata: sanitizedMetadata,
});
```

No longer collapses before/after/metadata into one field.

### 3. AuditLogsRepository (audit-logs.repository.ts)

Updated `CreateAuditLogData` and `FindAllAuditLogsParams` to use new field names and support all filters including `status` and `requestId`.

### 4. AuditLogResponse Mapper (audit-log-response.mapper.ts)

Fixed to return real values from DB fields:

```typescript
before: (log.before as Record<string, unknown>) ?? null,
after: (log.after as Record<string, unknown>) ?? null,
metadata: (log.metadata as Record<string, unknown>) ?? null,
actor: { id: log.actorId, email: log.actorEmail, roleId: log.actorRoleId },
request: { requestId: log.requestId, ipAddress: log.ipAddress, userAgent: log.userAgent },
status: log.status ?? 'SUCCESS',
```

No more fake nulls.

### 5. List Filters DTO (list-audit-logs.dto.ts)

Added `resourceType`, `resourceId`, `status`, `from`, `to` filters. Kept `entity`/`entityId` and `startDate`/`endDate` as `@deprecated` backward-compatible aliases.

### 6. Audit Context Helper (utils/audit-context.util.ts)

Created `getAuditRequestContext(req)` and `getAuditActorFromUser(user)`:

- `requestId` from `req.requestId` (custom property set by requestIdMiddleware)
- `ipAddress` from `req.ip` or `x-forwarded-for` first value
- `userAgent` from `req.headers['user-agent']`
- Actor id/email/roleId from current user object

Never stores authorization header, cookies, or body.

### 7. Controller Updates

All audited controllers (Users, Roles, Auth) now:
- Inject `@Req() req: Request`
- Pass `getAuditRequestContext(req)` as `request:` in audit calls
- Pass `getAuditActorFromUser(currentUser)` for actor with email/roleId

### 8. ResetPasswordWithTokenUseCase

Updated `execute()` signature:
```typescript
async execute(
  resetSessionToken: string,
  newPassword: string,
  auditContext?: { request?: AuditRequestContext },
): Promise<{ message: string }>
```

Controller now passes `getAuditRequestContext(req)` as `auditContext.request`. Use-case logs `after: { passwordReset: true, sessionsRevoked }`.

### 9. CreateAuditLogDto / CreateAuditLogUseCase

Updated to match new schema field names (resourceType, resourceId, ipAddress, before, after, status, actorEmail, actorRoleId).

---

## Tests Added/Updated

| File | Change |
|---|---|
| `audit-log.service.spec.ts` | Rewritten — tests before/after/metadata separate, actorEmail/actorRoleId, ipAddress, status default, non-blocking |
| `audit-logs.repository.spec.ts` | Rewritten — tests new field names, all filters including requestId/status/resourceType |
| `audit-log-response.mapper.spec.ts` | Rewritten — tests real before/after/metadata, actor email/roleId, request context |
| `audit-context.util.spec.ts` | New — 12 tests for request context extraction and actor extraction |

**Total tests:** 320 passed (was 291 in Phase 7-A)

---

## Validation Results

| Check | Result |
|---|---|
| `npm run build` | ✅ Pass |
| `npm run lint` | ✅ Pass |
| `npx prisma format` | ✅ Pass |
| `npx prisma validate` | ✅ Schema valid |
| `npx prisma generate` | ✅ Client generated |
| `npx ts-node scripts/validate-permissions.ts` | ✅ All 24 permissions valid |
| `npm run test` (320 tests) | ✅ 320/320 pass |
| `npm run quality:check` | ✅ 25 suites pass |

---

## Smoke Test Result

```
Nest application successfully started
```

---

## Coverage Summary

| Metric | Value |
|---|---|
| Test Suites | 25 passed |
| Tests | 320 passed |
| New tests (R1) | 29 added |

---

## Remaining Limitations

- `before` snapshots are not captured for all operations (would require refactoring use-cases to fetch previous state before making changes — acceptable for Phase 7-A)
- Audit logs are stored indefinitely — no retention/expiry policy
- No SIEM export / streaming to external systems

---

## Recommended Next Phase

**Phase 7-B — Request Observability**

Would add:
- `ApiRequestLog` full request/response logging for all API calls
- Request duration tracking
- Error request body capture
- Integration with audit logs via `requestId` correlation

---

## Phase 7-A Closure

Phase 7-A (base + R1) is now **closed** with commit:

```
fix(audit): complete audit contract context and snapshots
```

All acceptance criteria met:
- ✅ Audit logs store requestId/ipAddress/userAgent
- ✅ Audit logs store actorId/actorEmail/actorRoleId when available
- ✅ before/after/metadata stored separately
- ✅ Mapper returns real before/after/metadata, not fake nulls
- ✅ Audit list supports requestId filter
- ✅ Audit list supports status filter
- ✅ Audit list supports resourceType/resourceId filters
- ✅ Audit list supports from/to date range
- ✅ Audit service remains non-blocking
- ✅ Sensitive data still redacted recursively
- ✅ User/role/auth audit calls pass request context
- ✅ Password reset audit receives request context from controller
- ✅ Existing Phase 5/6/7-A tests still pass
- ✅ New R1 tests pass
- ✅ Build passes, Lint passes, Prisma valid
- ✅ Permission validation passes
- ✅ Test suite passes (320)
- ✅ Quality gate passes
- ✅ Docs updated, R1 QA report exists