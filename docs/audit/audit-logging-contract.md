# Audit Logging Contract

**Date:** 2026-06-10
**Phase:** 7-A

---

## Overview

Audit logging records high-value state changes for security review, compliance, and incident investigation. It is **non-blocking**: audit failures must never break business operations.

---

## AuditLog Entity

The `AuditLog` Prisma model stores all audit records:

```prisma
model AuditLog {
  id        String   @id @default(uuid())
  actorId   String?
  action    String
  entity    String?
  entityId  String?
  metadata  Json?
  ip        String?
  userAgent String?
  requestId String?
  createdAt DateTime @default(now()) @map("created_at")
}
```

| Field | Description |
|---|---|
| `actorId` | ID of the user who triggered the action (null for system actions) |
| `action` | Dot/kebab string from `AUDIT_ACTIONS` registry (e.g. `users.create`) |
| `entity` | PascalCase resource type (e.g. `User`, `Role`) |
| `entityId` | UUID of the affected resource |
| `metadata` | JSON snapshot — sanitized before storage |
| `ip` | IP address of the request |
| `userAgent` | User-Agent header |
| `requestId` | Internal request tracking ID |
| `createdAt` | Timestamp of the event |

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
    await this.auditLogsRepository.create({ ... });
  } catch (err) {
    this.logger.warn(`Failed to write audit log [${input.action}]: ...`);
  }
}
```

---

## Audit Injection Points

Audit logging is added at the **controller level** — after successful business operations. This avoids invasive changes to use-case method signatures.

### UsersController

| Method | Action | Trigger |
|---|---|---|
| `POST /users` | `users.create` | User created |
| `PATCH /users/:id/status` | `users.update-status` | Status changed |
| `PATCH /users/:id/role` | `users.update-role` | Role changed |
| `POST /users/:id/permissions-override` | `users.permissions-override` | Override applied |

### RolesController

| Method | Action | Trigger |
|---|---|---|
| `POST /roles` | `roles.create` | Role created |
| `PATCH /roles/:id` | `roles.update` | Role updated |
| `DELETE /roles/:id` | `roles.delete` | Role deleted |
| `PATCH /roles/:id/disable` | `roles.disable` | Role disabled |
| `POST /roles/:id/permissions` | `roles.update-permissions` | Permissions updated |
| `POST /roles/:id/duplicate` | `roles.duplicate` | Role duplicated |

### AuthController

| Method | Action | Trigger |
|---|---|---|
| `POST /auth/change-password` | `auth.password-change` | Password changed |
| `POST /auth/logout-all` | `auth.logout-all` | All sessions terminated |

### ResetPasswordWithTokenUseCase

| Method | Action | Trigger |
|---|---|---|
| `execute()` success | `auth.password-reset-success` | Password reset completed |

---

## Endpoints

### `GET /audit-logs`

List audit logs with pagination and filtering.

**Query parameters:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `actorId` — filter by actor
- `action` — filter by action string
- `entity` — filter by entity type
- `startDate` / `endDate` — date range

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
  status: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  actor: { id: string | null; email: string | null; roleId: string | null } | null;
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