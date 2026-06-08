# Phase 0 — Current State Review

**Date:** 2026-06-09
**Phase:** 0 — Inspection, Documentation & QA Review
**Reference:** [Master Plan](../architecture/devspherex-nest-admin-api-master-plan.md)

---

## 1. Current Project Structure Summary

```
devspherex-nest-admin-api/
├── docs/
│   ├── architecture/
│   │   └── devspherex-nest-admin-api-master-plan.md
│   └── devspherex_nest_admin_api_master_plan.md
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── common/
│   │   ├── database/
│   │   │   ├── database.module.ts
│   │   │   └── prisma.service.ts
│   │   ├── decorators/
│   │   │   └── current-user.decorator.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   └── guards/
│   │       └── jwt-auth.guard.ts
│   ├── config/
│   │   ├── config.module.ts
│   │   └── configuration.ts
│   └── modules/
│       ├── auth/
│       │   ├── auth.controller.ts
│       │   ├── auth.module.ts
│       │   ├── dto/
│       │   ├── repositories/
│       │   ├── services/
│       │   ├── strategies/
│       │   └── use-cases/
│       ├── users/
│       │   ├── users.controller.ts
│       │   ├── users.module.ts
│       │   ├── dto/
│       │   ├── mappers/
│       │   ├── policies/
│       │   ├── repositories/
│       │   └── use-cases/
│       ├── roles/
│       │   ├── roles.controller.ts
│       │   ├── roles.module.ts
│       │   ├── dto/
│       │   ├── mappers/
│       │   ├── policies/
│       │   ├── repositories/
│       │   └── use-cases/
│       ├── permissions/
│       │   ├── permissions.controller.ts
│       │   ├── permissions.module.ts
│       │   ├── dto/
│       │   ├── mappers/
│       │   ├── repositories/
│       │   ├── services/
│       │   └── use-cases/
│       └── audit-logs/
│           ├── audit-logs.controller.ts
│           ├── audit-logs.module.ts
│           ├── dto/
│           ├── repositories/
│           └── use-cases/
├── .env
├── .env.example
├── .gitignore
├── .eslintrc.js
├── jest.config.js
├── nest-cli.json
├── package.json
└── tsconfig.json
```

### Modules Summary

| Module | Controllers | Use Cases | Repositories | Policies | Services |
|--------|-------------|-----------|--------------|----------|----------|
| Auth | 1 | 8 | 1 | 0 | 3 |
| Users | 1 | 9 | 1 | 1 | 0 |
| Roles | 1 | 7 | 1 | 1 | 0 |
| Permissions | 1 | 3 | 1 | 0 | 1 |
| Audit Logs | 1 | 2 | 1 | 0 | 0 |

---

## 2. What Exists vs. What Master Plan Requires

### ✅ Exists

- Basic modular architecture following Practical Clean Modular pattern
- Controllers handle HTTP concerns only (routing, guards, DTO validation, calling use cases)
- Use cases per operation structure
- Repositories for database access only
- Policies for business protection rules
- Mappers for response shaping (passwordHash not returned)
- Services for reusable domain logic
- Basic JWT authentication
- Refresh token support
- User, Role, Permission, AuditLog models
- Join tables for RolePermission and UserPermissionOverride
- Basic indexes on database models

### ❌ Missing / Incomplete

| Category | Missing Items |
|----------|---------------|
| **Prisma Schema** | `tokenVersion` field on User, `slug` on Role, `effect` on UserPermissionOverride, `jti`/`familyId` on RefreshToken, `ApiRequestLog` model, `deletedAt` for soft delete |
| **Auth Security** | No token versioning (tokenVersion not in JWT payload, not validated on requests), no increment on logout/change-password |
| **Refresh Token** | No token rotation, no jti/family tracking, stored as raw token instead of hash only |
| **RBAC** | No `@Public()` decorator, no `@Permissions()` decorator, no `PermissionsGuard`, no `system-permissions.ts` source of truth |
| **Central Permissions** | No `src/common/rbac/system-permissions.ts` file |
| **API Response** | No standard success/error response shape, no response interceptor, no pagination meta DTO |
| **Swagger** | No Swagger decorators, no `/api/docs` endpoint, no swagger files per module |
| **Logging** | No structured logger, no daily log files, no slow API detection, no request logging interceptor |
| **Audit** | AuditLog model exists but not integrated into use cases, no audit action constants |
| **Seed** | No `prisma/seed.ts`, no idempotent seed, no default admin creation |
| **Security** | No Helmet, no rate limiting, no CORS env config, no env validation, no login throttling |
| **Database Indexes** | Missing composite indexes, missing some single field indexes per master plan |

---

## 3. Prisma Schema Issues

### Critical Errors from `npx prisma validate`:

```
Error: Prisma schema validation - (validate wasm)
Error code: P1012

error: Error validating model "Role": The index definition refers to the unknown fields: is_system.
  --> prisma\schema.prisma:57
   |
57 |  @@index([is_system])
   |

error: Error validating model "Permission": The index definition refers to the unknown fields: group_name.
  --> prisma\schema.prisma:73
   |
73 |  @@index([group_name])
   |

error: Error validating model "AuditLog": The index definition refers to the unknown fields: entity_type.
  --> prisma\schema.prisma:147
   |
146 |  @@index([action])
147 |  @@index([entity_type])
   |

error: Error validating model "AuditLog": The index definition refers to the unknown fields: entity_id.
  --> prisma\schema.prisma:148
   |
148 |  @@index([entity_id])
   |

error: The datasource property `url` is no longer supported in schema files.
  --> prisma\schema.prisma:10
   |
 9 |  provider = "postgresql"
10 |  url      = env("DATABASE_URL")
   |
```

### Issue Details:

1. **Index field names use mapped column names instead of schema field names**
   - `@@index([is_system])` should use the field name `isSystem` not the column name `is_system`
   - Same for `group_name` → `groupName`, `entity_type` → `entityType`, `entity_id` → `entityId`

2. **Prisma 7 Breaking Change**
   - `url` in datasource is no longer supported
   - Requires `prisma.config.ts` for connection URLs or adapter configuration

### Additional Schema Issues:

| Issue | Location | Severity |
|-------|----------|----------|
| Missing `tokenVersion` field on User | schema.prisma | Critical |
| Missing `slug` field on Role | schema.prisma | High |
| Missing `effect` field on UserPermissionOverride (allow/deny) | schema.prisma | Critical |
| Missing `jti`, `familyId`, `tokenHash`, `replacedByTokenId` on RefreshToken | schema.prisma | Critical |
| Missing `ApiRequestLog` model | schema.prisma | High |
| Missing `deletedAt` soft delete fields | schema.prisma | Medium |
| Missing `lastLoginAt` on User | schema.prisma | Medium |
| Missing `status` on Role | schema.prisma | Medium |
| Missing `key`, `resource`, `action`, `isSystem` on Permission | schema.prisma | High |
| Missing `requestId` on AuditLog | schema.prisma | Medium |

---

## 4. Database Normalization Issues

### ✅ Correct

- Role permissions use join table `RolePermission` (not JSON array)
- User permission overrides use join table `UserPermissionOverride` (not JSON array)
- Refresh tokens in separate table
- Audit logs in separate table

### ❌ Issues

- User permission overrides lack `effect: allow | deny` field for direct deny priority
- RefreshToken model does not track token families for rotation/reuse detection
- No soft delete (`deletedAt`) fields on User and Role

---

## 5. Database Indexing/Performance Issues

### Current Indexes (from schema.prisma):

```prisma
// User
@@index([email])
@@index([status])
@@index([roleId])

// Role
@@index([is_system])  // ERROR: should be [isSystem]

// Permission
@@index([group_name])  // ERROR: should be [groupName]
@@index([name])

// RolePermission
@@unique([roleId, permissionId])
@@index([roleId])
@@index([permissionId])

// UserPermissionOverride
@@unique([userId, permissionId])
@@index([userId])
@@index([permissionId])

// RefreshToken
@@index([token])
@@index([userId])
@@index([expiresAt])

// AuditLog
@@index([userId])
@@index([action])
@@index([entity_type])  // ERROR: should be [entityType]
@@index([entity_id])   // ERROR: should be [entityId]
@@index([createdAt])
```

### Missing Required Indexes (per Master Plan):

| Table | Missing Indexes |
|-------|-----------------|
| User | `[status, roleId, createdAt]` composite, `deletedAt` |
| Role | `slug` unique, `status`, `deletedAt` |
| Permission | `key` unique, `resource`, `action`, `[resource, action]` composite |
| RefreshToken | `jti` unique, `familyId`, `[userId, revokedAt]` composite |
| AuditLog | `[entity, entityId, createdAt]`, `[action, createdAt]`, `[actorId, createdAt]` |
| ApiRequestLog | `requestId` unique, `path`, `statusCode`, `durationMs`, `[path, createdAt]`, `[statusCode, createdAt]` |

---

## 6. Auth/Security Issues

### Critical Issues:

| Issue | Severity | Description |
|-------|----------|-------------|
| No `tokenVersion` in User model | Critical | Cannot invalidate tokens on security events |
| No `tokenVersion` in JWT payload | Critical | JwtStrategy does not validate token version |
| No token invalidation on logout | Critical | Old access tokens remain valid after logout |
| No token invalidation on change-password | Critical | Old tokens remain valid after password change |
| No token invalidation on disable user | Critical | Disabled user tokens remain valid |
| JWT secret has default fallback | High | `your-secret-key-change-in-production` is predictable |

### JWT Payload (Current):

```ts
{
  sub: user.id,
  email: user.email,
  roleId: user.roleId
  // Missing: tokenVersion
}
```

### JWT Payload (Required per Master Plan):

```ts
{
  sub: user.id,
  email: user.email,
  roleId: user.roleId,
  tokenVersion: user.tokenVersion
}
```

---

## 7. Token Versioning Issues

### Current State:

- ❌ No `tokenVersion` field on User model
- ❌ No `tokenVersion` in JWT payload
- ❌ No version comparison in JwtStrategy
- ❌ No increment logic in logout, change-password, or disable user

### Required per Master Plan:

- `User.tokenVersion` field (integer, default 1)
- JWT payload includes `tokenVersion`
- JwtStrategy validates `payload.tokenVersion === user.tokenVersion`
- Increment `tokenVersion` on:
  - logout
  - logout-all
  - change password
  - reset password
  - disable user
  - change email
  - change role

---

## 8. Refresh Token Issues

### Current Design:

```prisma
model RefreshToken {
  id        String   @id @default(uuid())
  token     String   @unique  // Stored as-is (not hashed)
  userId    String   @map("user_id")
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")
  revokedAt DateTime? @map("revoked_at")
}
```

### Issues:

| Issue | Severity | Description |
|-------|----------|-------------|
| Raw token stored | Critical | Should store hash only, raw token returned to client once |
| No `jti` | Critical | No unique identifier for token tracking |
| No `familyId` | Critical | No token family tracking for reuse detection |
| No `tokenHash` | Critical | Should store bcrypt hash, not raw token |
| No `replacedByTokenId` | Medium | No chain tracking for rotation |
| No refresh token rotation | Critical | Same token reused, new one not issued |
| No family-based reuse detection | Critical | Cannot detect stolen token reuse |

### Required per Master Plan:

```prisma
model RefreshToken {
  id               String    @id @default(uuid())
  userId           String    @map("user_id")
  tokenHash        String    @map("token_hash")  // bcrypt hash
  jti              String    @unique @map("jti")  // unique token ID
  familyId         String    @map("family_id")   // for reuse detection
  expiresAt        DateTime  @map("expires_at")
  revokedAt        DateTime? @map("revoked_at")
  replacedByTokenId String?  @map("replaced_by_token_id")
  createdAt        DateTime  @default(now()) @map("created_at")
}
```

---

## 9. RBAC Issues

### Current State:

- ❌ No `@Public()` decorator
- ❌ No `@Permissions()` decorator
- ❌ No `PermissionsGuard`
- ❌ No `system-permissions.ts` source of truth
- ❌ No effective permissions service with allow/deny logic
- ❌ All endpoints protected with JwtAuthGuard only (no permission checks)

### Required per Master Plan:

```ts
// Decorators
@Public()
@Permissions(PERMISSIONS.USERS.READ.key)

// Guards
PermissionsGuard // validates permissions from JWT + user overrides

// Source of Truth
src/common/rbac/system-permissions.ts
```

### Effective Permissions Logic Required:

```
effective permissions =
  role permissions
  + direct allow permissions
  - direct deny permissions

// Direct deny takes priority
```

---

## 10. Central Permissions Source of Truth Issues

### Current State:

- ❌ No `src/common/rbac/system-permissions.ts` file
- ❌ No centralized permission constants
- ❌ Permission strings hardcoded in controllers (future issue when RBAC added)

### Required per Master Plan:

```ts
// src/common/rbac/system-permissions.ts
export const SYSTEM_PERMISSIONS = {
  USERS: {
    READ: { key: 'users.read', resource: 'users', action: 'read', label: 'View users', group: 'Users' },
    CREATE: { key: 'users.create', resource: 'users', action: 'create', label: 'Create users', group: 'Users' },
    UPDATE: { key: 'users.update', resource: 'users', action: 'update', label: 'Update users', group: 'Users' },
    DELETE: { key: 'users.delete', resource: 'users', action: 'delete', label: 'Delete users', group: 'Users' },
  },
  ROLES: { ... },
  PERMISSIONS: { ... },
  AUDIT_LOGS: { ... },
} as const;
```

---

## 11. API Response/Error Format Issues

### Current Response Format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "timestamp": "2026-06-09T00:00:00.000Z"
}
```

### Required per Master Plan:

**Success:**
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {},
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "errors": []
}
```

### Missing Required Files:

- `src/common/interceptors/response.interceptor.ts`
- `src/common/dto/api-response.dto.ts`
- `src/common/dto/pagination-meta.dto.ts`
- `src/common/utils/pagination.util.ts`

---

## 12. Swagger Structure Issues

### Current State:

- ❌ No Swagger setup
- ❌ No `/api/docs` endpoint
- ❌ No swagger decorators in controllers
- ❌ No swagger files per module

### Required per Master Plan:

```
modules/{module-name}/
  swagger/
    {module-name}.swagger.ts
```

```ts
// modules/auth/swagger/auth.swagger.ts
export const AuthSwagger = {
  login: () => applyDecorators(
    ApiOperation({ summary: 'User login' }),
    ApiOkResponse({ description: 'Login successful' }),
    ApiBearerAuth(),
  ),
  // ...
};
```

---

## 13. Logging Issues

### Current State:

- ❌ No structured logger
- ❌ No daily log files
- ❌ No slow API detection
- ❌ No request logging interceptor
- ❌ No log redaction
- ❌ Only basic `Logger` from NestJS used in bootstrap

### Required per Master Plan:

```
src/common/logging/
  logger.module.ts
  logger.service.ts
  request-context.middleware.ts
  request-logging.interceptor.ts
  slow-request.interceptor.ts
  log-redaction.util.ts
```

### Log Files Required:

```
logs/app/YYYY-MM-DD.log
logs/error/YYYY-MM-DD.log
logs/http/YYYY-MM-DD.log
logs/audit/YYYY-MM-DD.log
```

---

## 14. Audit/Request Tracking Issues

### Current State:

- AuditLog model exists but not integrated
- No audit action constants
- No `@Public()` decorator to mark public endpoints for audit exclusion
- No `requestId` field on AuditLog for correlation
- No ApiRequestLog model for HTTP request logging

### Audit Actions Not Integrated:

- login / failed login
- logout / logout all
- password changed
- user created / updated / disabled / role changed
- role created / updated / deleted / permissions updated
- refresh token reuse detected

---

## 15. Seed/Database Setup Issues

### Current State:

- ❌ No `prisma/seed.ts` file
- ❌ No idempotent seed
- ❌ No default admin creation
- ❌ No permissions seeded from source of truth
- ❌ No roles seeded

### Required per Master Plan:

```ts
// prisma/seed.ts
// - Permissions from system-permissions.ts
// - Roles: Super Admin, Admin, Manager, Staff, Viewer
// - Default admin from env vars
// - Idempotent (safe to run multiple times)
```

---

## 16. Package/Dependency Issues

### npm install Result: **FAILED**

```
Exit code 1
npm error code1
npm error path D:\Web\templets\Nestjs\devspherex-nest-admin-api\node_modules\bcrypt
npm error command failed
```

**Root Cause:** bcrypt native module build failure

```
npm error gyp ERR! configure error 
npm error gyp ERR! stack Error: ENOENT: no such file or directory, open 'C:\certs\company-root.pem'
```

This is a **corporate environment issue** - the build tools cannot find the company root certificate. This is not a code issue but an environment/configuration issue.

### Dependency Issues:

| Package | Issue | Severity |
|---------|-------|----------|
| bcrypt | Native module build failure on Node.js v24 | High (environment) |
| eslint | Not installed due to npm install failure | High |
| @nestjs/* | Not installed due to npm install failure | High |
| @prisma/client | Not installed due to npm install failure | High |

---

## 17. Build/Lint/Prisma Validation Status

### Command Results:

| Command | Status | Notes |
|---------|--------|-------|
| `npm install` | ❌ FAILED | bcrypt build failure (corporate environment) |
| `npm run build` | ❌ CANNOT RUN | Dependencies not installed |
| `npx prisma validate` | ❌ FAILED | 5 validation errors (index names + Prisma 7 breaking change) |
| `npm run lint` | ❌ CANNOT RUN | Dependencies not installed |

### Prisma Validate Errors:

```
Error code: P1012
- @@index([is_system]) → should be @@index([isSystem])
- @@index([group_name]) → should be @@index([groupName])
- @@index([entity_type]) → should be @@index([entityType])
- @@index([entity_id]) → should be @@index([entityId])
- datasource url property no longer supported in Prisma 7
```

---

## 18. Critical Issues That Must Be Fixed Before Adding New Features

### Priority 1 (Blocking):

1. **Prisma Schema Index Errors** - Fix `@@index` to use field names not column names
2. **Prisma 7 Breaking Change** - Update datasource configuration for Prisma 7
3. **Add `tokenVersion` to User model** - Required for token invalidation
4. **Add `tokenVersion` to JWT payload** - Required for token versioning
5. **Implement token invalidation logic** - On logout, change-password, disable user
6. **Hash refresh tokens** - Store hash only, not raw token
7. **Add `jti` and `familyId` to RefreshToken** - For token rotation and reuse detection

### Priority 2 (High):

8. **Add `effect: allow | deny` to UserPermissionOverride** - For direct deny priority
9. **Create `system-permissions.ts`** - Central permissions source of truth
10. **Add RBAC decorators and guards** - `@Public()`, `@Permissions()`, `PermissionsGuard`
11. **Implement standard API response shape** - Response interceptor and error format
12. **Add Swagger setup** - `/api/docs` endpoint and decorators
13. **Add structured logging** - Logger service and request logging

### Priority 3 (Medium):

14. **Add soft delete fields** - `deletedAt` on User, Role
15. **Add missing indexes** - Per database index strategy
16. **Create seed.ts** - Idempotent seed with default admin
17. **Add security hardening** - Helmet, rate limiting, CORS env config

---

## 19. Recommended Phase 1 Scope

Based on the Master Plan, **Phase 1** should focus on:

### Scope:
- Fix Prisma schema index errors (use field names not column names)
- Update Prisma schema for Prisma 7 compatibility
- Add missing fields: `tokenVersion`, `slug`, `effect`, `jti`, `familyId`, `tokenHash`, `replacedByTokenId`
- Add missing models: `ApiRequestLog`
- Add soft delete fields: `deletedAt`
- Add missing Permission fields: `key`, `resource`, `action`, `isSystem`
- Add missing Role fields: `slug`, `status`
- Add missing User fields: `lastLoginAt`
- Update RefreshToken model for proper token storage

### Output:
```
docs/database/schema-contract.md
docs/qa/phase-1-database-contract-qa-report.md
```

### Validation:
```bash
npx prisma validate
npm run build
```

---

## Commands Executed Summary

| Command | Exit Code | Output |
|---------|-----------|--------|
| `npm install` | 1 | bcrypt build failure - corporate environment certificate issue |
| `npm run build` | 1 | Cannot run - dependencies not installed |
| `npx prisma validate` | 1 | 5 validation errors - index names and Prisma 7 breaking change |
| `npm run lint` | 1 | Cannot run - dependencies not installed |

---

## Files Created in Phase 0

1. `docs/architecture/devspherex-nest-admin-api-master-plan.md` - Copied from `docs/devspherex_nest_admin_api_master_plan.md`
2. `docs/qa/phase-0-current-state-review.md` - This report

---

## Next Steps

1. Review this QA report
2. Proceed to Phase 1: Prisma Schema & Database Contract
3. Fix critical Prisma schema issues before any other implementation
