# Audit Logging Contract

**Date:** 2026-06-10
**Phase:** 7-A (updated R1)

---

## Overview

Audit logging records high-value state changes for security review, compliance, and incident investigation. It is **non-blocking**: audit failures must never break business operations.

---

## AuditLog Entity

The `AuditLog` Prisma model stores all audit records:

```prisma
model AuditLog {
  id           String   @id @default(uuid())
  actorId      String?  @map("actor_id")
  actorEmail   String?  @map("actor_email")
  actorRoleId  String?  @map("actor_role_id")
  action       String   @map("action")
  resourceType String?  @map("resource_type")
  resourceId   String?  @map("resource_id")
  status       String   @default("SUCCESS") @map("status")
  requestId    String?  @map("request_id")
  ipAddress    String?  @map("ip_address")
  userAgent    String?  @map("user_agent")
  before       Json?    @map("before")
  after        Json?    @map("after")
  metadata     Json?    @map("metadata")
  createdAt    DateTime @default(now()) @map("created_at")
}
```

| Field | Description |
|---|---|
| `actorId` | ID of the user who triggered the action (null for system actions) |
| `actorEmail` | Email of the actor when available |
| `actorRoleId` | Role ID of the actor when available |
| `action` | Dot/kebab string from `AUDIT_ACTIONS` registry (e.g. `users.create`) |
| `resourceType` | PascalCase resource type (e.g. `User`, `Role`) |
| `resourceId` | UUID of the affected resource |
| `status` | `SUCCESS` or `FAILURE` |
| `requestId` | Phase 6 request tracking ID (correlation) |
| `ipAddress` | IP address of the request (supports x-forwarded-for) |
| `userAgent` | User-Agent header |
| `before` | JSON snapshot before the change (sanitized) |
| `after` | JSON snapshot after the change (sanitized) |
| `metadata` | Additional structured metadata (sanitized) |
| `createdAt` | Timestamp of the event |

### Indexes

```
@@index([action])
@@index([resourceType, resourceId])
@@index([actorId])
@@index([requestId])
@@index([status])
@@index([createdAt])
```

---

## Audit Actions Registry

All audit actions are defined in `src/modules/audit-logs/constants/audit-actions.ts`. Actions are **immutable** — adding a new action requires adding a new constant.

### User Actions

| Constant | Value | Trigger |
|---|---|---|
| `USERS_CREATE` | `users.create` | User created |
| `USERS_UPDATE` | `users.update` | User profile updated |
| `USERS_DISABLE` | `users.disable` | User disabled |
| `USERS_ENABLE` | `users.enable` | User re-enabled |
| `USERS_UPDATE_ROLE` | `users.update-role` | User role changed |
| `USERS_UPDATE_STATUS` | `users.update-status` | User status changed |
| `USERS_PERMISSIONS_OVERRIDE` | `users.permissions-override` | Effective permissions overridden |

### Role Actions

| Constant | Value | Trigger |
|---|---|---|
| `ROLES_CREATE` | `roles.create` | Role created |
| `ROLES_UPDATE` | `roles.update` | Role updated |
| `ROLES_DELETE` | `roles.delete` | Role deleted |
| `ROLES_DISABLE` | `roles.disable` | Role disabled |
| `ROLES_UPDATE_PERMISSIONS` | `roles.update-permissions` | Role permissions changed |
| `ROLES_DUPLICATE` | `roles.duplicate` | Role duplicated |

### Auth Actions

| Constant | Value | Trigger |
|---|---|---|
| `AUTH_PASSWORD_CHANGE` | `auth.password-change` | Password changed |
| `AUTH_LOGOUT_ALL` | `auth.logout-all` | All sessions terminated |
| `AUTH_PASSWORD_RESET_SUCCESS` | `auth.password-reset-success` | Password reset completed |

---

## Resource Types Registry

Defined in `src/modules/audit-logs/constants/audit-resource-types.ts`.

| Constant | Value |
|---|---|
| `USER` | `User` |
| `ROLE` | `Role` |
| `PERMISSION` | `Permission` |
| `AUTH_SESSION` | `AuthSession` |
| `PASSWORD_RECOVERY` | `PasswordRecovery` |

---

## Sensitive Data Sanitization

The `sanitizeAuditData()` function recursively removes sensitive values **before** audit storage. It operates on the `before`, `after`, and `metadata` fields of every audit log entry.

### Sensitive Keys (case-insensitive)

```
password, currentPassword, newPassword, oldPassword,
passwordConfirm, passwordHash, accessToken, refreshToken,
token, tokenHash, rawToken, jti, secret, otp, otpHash,
resetToken, resetTokenHash, pepper, authorization, cookie,
setCookie, apiKey, privateKey, clientSecret
```

### Rules

- Key matching is **case-insensitive** (`PASSWORD`, `Password`, `password` all redacted)
- Redacted value is always the string `<redacted>`
- Original objects are **never mutated** — sanitizer returns new objects
- Maximum traversal depth: **20 levels** (prevents stack overflow on circular structures)
- Arrays are traversed — individual array elements are sanitized
- Primitives (strings, numbers, booleans, null, undefined) are returned unchanged

---

## Non-Blocking Guarantee

`AuditLogService.log()` wraps repository calls in `try/catch`. On failure:
1. Error is **logged** via `Logger.warn()`
2. Error is **never re-thrown**
3. Business operation continues normally

```typescript
async log(input: CreateAuditLogInput): Promise<void> {
  try {
    const sanitizedBefore = input.before !== undefined ? sanitizeAuditData(input.before) : undefined;
    const sanitizedAfter = input.after !== undefined ? sanitizeAuditData(input.after) : undefined;
    const sanitizedMetadata = input.metadata !== undefined ? sanitizeAuditData(input.metadata) : undefined;
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
  } catch (err) {
    this.logger.warn(`Failed to write audit log [${input.action}]: ...`);
  }
}
```

---

## Audit Context Extraction

`getAuditRequestContext(req)` and `getAuditActorFromUser(user)` in `src/modules/audit-logs/utils/audit-context.util.ts` safely extract audit context from Express Request and current user objects.

- `requestId` — from `req.requestId` (set by requestIdMiddleware)
- `ipAddress` — from `req.ip` or `x-forwarded-for` first value
- `userAgent` — from `req.headers['user-agent']`
- `actor.id/email/roleId` — from current user object

**Never stored:** authorization header, cookies, request body, query parameters.

---

## Audit Injection Points

Audit logging is added at the **controller level** — after successful business operations. Every audit call includes request context (requestId, ipAddress, userAgent) and actor info (id, email, roleId when available).

### UsersController

| Method | Action | Notes |
|---|---|---|
| `POST /users` | `users.create` | after: safe user summary |
| `PUT /users/:id/status` | `users.update-status` | after: { status } |
| `PUT /users/:id/role` | `users.update-role` | after: { roleId } |
| `PUT /users/:id/permission-overrides` | `users.permissions-override` | after: { permissionOverrides } |

### RolesController

| Method | Action | Notes |
|---|---|---|
| `POST /roles` | `roles.create` | after: safe role summary |
| `PUT /roles/:id` | `roles.update` | after: changed fields |
| `DELETE /roles/:id` | `roles.delete` | no before/after |
| `PUT /roles/:id/permissions` | `roles.update-permissions` | after: { permissionIds } |
| `POST /roles/:id/duplicate` | `roles.duplicate` | after: new role summary |

### AuthController

| Method | Action | Notes |
|---|---|---|
| `POST /auth/change-password` | `auth.password-change` | after: { passwordChanged: true } |
| `POST /auth/logout-all` | `auth.logout-all` | after: { sessionsRevoked: true } |
| `POST /auth/reset-password` | `auth.password-reset-success` | after: { passwordReset, sessionsRevoked } |

---

## Endpoints

### `GET /audit-logs`

List audit logs with pagination and filtering.

**Query parameters:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `actorId` — filter by actor
- `action` — filter by action string
- `resourceType` — filter by resource type (preferred over `entity`)
- `resourceId` — filter by resource ID (preferred over `entityId`)
- `status` — `SUCCESS` or `FAILURE`
- `requestId` — filter by request tracking ID
- `from` / `to` — date range (ISO 8601, preferred over `startDate`/`endDate`)

**Response:**
```json
{
  "items": [{ /* AuditLogResponse */ }],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### `GET /audit-logs/:id`

Retrieve a single audit log by ID.

**Response:** `AuditLogResponse`

**Errors:**
- `404 NotFoundException` — Audit log not found

---

## AuditLogResponse Shape

```typescript
interface AuditLogResponse {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  status: 'SUCCESS' | 'FAILURE';
  actor: {
    id: string | null;
    email: string | null;
    roleId: string | null;
  };
  request: {
    requestId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
  };
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string; // ISO 8601
}
```

---

## Permissions

| Permission | Endpoint | Description |
|---|---|---|
| `audit-logs.read` | `GET /audit-logs` | List audit logs |
| `audit-logs.read` | `GET /audit-logs/:id` | Read single audit log |

Both endpoints require `audit-logs.read` permission.

---

## Out of Scope (Phase 7-A)

- Request observability / full request logging for every API call
- Swagger documentation
- External monitoring / alerting integration
- Real email/WhatsApp/SMS provider implementations