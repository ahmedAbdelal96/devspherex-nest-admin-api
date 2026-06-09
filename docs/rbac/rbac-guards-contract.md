# RBAC Guards & Decorators Contract

## Phase 4 - RBAC Decorators, Guards & Effective Permissions

---

## 1. Security Model

Phase 4 introduces a **default-deny** RBAC protection layer for the entire API.

Every endpoint MUST be explicitly classified into one of four categories using a decorator. An unclassified non-public route is automatically denied.

| Classification | Decorator | JWT Required | Permission Required |
|---------------|-----------|:------------:|:-------------------:|
| Public | `@Public()` | ❌ | ❌ |
| Authenticated-only | `@Authenticated()` | ✅ | ❌ |
| Permission-protected (ALL) | `@Permissions(...)` | ✅ | ✅ (all) |
| Permission-protected (ANY) | `@AnyPermissions(...)` | ✅ | ✅ (at least one) |

If a non-public route has **none** of these decorators, the `PermissionsGuard` will throw `ForbiddenException` with message `Access denied: route requires explicit classification`.

---

## 2. Decorators

All decorators live under `src/common/rbac/decorators/` and are exported from `@common/rbac`.

### 2.1 `@Public()`

Marks a route as public — no JWT, no RBAC check.

**Use for:** login, register, refresh, forgot-password, reset-password.

**Behavior:**
- `JwtAuthGuard` returns `true` (skips token validation).
- `PermissionsGuard` returns `true` (skips permission check).

```ts
@Public()
@Post('login')
async login(@Body() dto: LoginDto) { ... }
```

**Metadata key:** `IS_PUBLIC_KEY` = `'is_public'`

---

### 2.2 `@Authenticated()`

Marks a route as requiring a valid JWT but NOT specific RBAC permissions.

**Use for:** self-service endpoints like `/auth/me`, `/auth/logout`, `/auth/logout-all`, `/auth/change-password`.

**Behavior:**
- `JwtAuthGuard` enforces a valid access token.
- `PermissionsGuard` allows access once `request.user` is populated.

```ts
@Authenticated()
@Get('me')
async getMe(@CurrentUser('id') userId: string) { ... }
```

**Why this decorator exists:** it removes ambiguity. A protected route with no permission requirement is intentionally authenticated-only, not "forgot to add a permission".

**Metadata key:** `IS_AUTHENTICATED_KEY` = `'is_authenticated'`

---

### 2.3 `@Permissions(...keys)`

Requires **ALL** listed permissions (AND logic).

**Use for:** admin actions that need a specific set of permissions to be present together.

```ts
@Permissions(SYSTEM_PERMISSION_KEYS.USERS.READ)
@Permissions(
  SYSTEM_PERMISSION_KEYS.USERS.CREATE,
  SYSTEM_PERMISSION_KEYS.USERS.UPDATE,
)
```

**Behavior:**
- All keys are validated against `SYSTEM_PERMISSION_KEY_SET` at decoration time.
- If any key is unknown, throws `Error('Invalid permission key: "<key>"')` immediately.
- The guard reads the keys and uses `EffectivePermissionsService.hasAllPermissions`.

**Metadata keys:**
- `REQUIRED_PERMISSIONS_KEY` = `'required_permissions'`
- `PERMISSION_MODE_KEY` = `'all'`

**Type-safety:** the parameter is typed as `SystemPermissionKey[]`, so invalid keys are caught at compile time as well.

---

### 2.4 `@AnyPermissions(...keys)`

Requires **at least one** of the listed permissions (OR logic).

```ts
@AnyPermissions(
  SYSTEM_PERMISSION_KEYS.USERS.READ,
  SYSTEM_PERMISSION_KEYS.USERS.UPDATE,
)
```

**Behavior:** same validation as `@Permissions`, but the guard uses `EffectivePermissionsService.hasAnyPermission`.

**Metadata keys:** same as `@Permissions` but with `PERMISSION_MODE_KEY = 'any'`.

---

## 3. Guard Order

Guards are registered globally in `AppModule` via `APP_GUARD`:

1. `JwtAuthGuard` — authenticates the request.
2. `PermissionsGuard` — enforces classification and permissions.

```ts
providers: [
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_GUARD, useClass: PermissionsGuard },
],
```

### Why this order

- `JwtAuthGuard` runs first. It honors `@Public()` and skips token validation for public routes.
- For non-public routes, `JwtAuthGuard` ensures `request.user` is populated (or throws `UnauthorizedException`).
- `PermissionsGuard` then reads `request.user`, the metadata from the decorators, and decides allow/deny.

---

## 4. Default-Deny Rule

`PermissionsGuard` decision flow:

1. If `@Public()` → **allow**.
2. If `request.user` missing → **deny** (`ForbiddenException('Access denied')`).
3. If route has `@Permissions(...)` or `@AnyPermissions(...)` → evaluate permissions.
4. If route has `@Authenticated()` only (no permissions metadata) → **allow** (JWT already validated).
5. If route has NO decorator (not public, not authenticated, not permission-protected) → **deny** (`ForbiddenException('Access denied: route requires explicit classification')`).

**This means no route can be accidentally exposed.** A new endpoint without a decorator will be denied at runtime.

---

## 5. Effective Permissions Calculation

`EffectivePermissionsService` computes a `Set<SystemPermissionKey>` for a given `userId`.

### Algorithm

```
effective = {}

1. Load user (with role and role.permissions, permissionOverrides)
2. If user not found OR user.status !== 'ACTIVE' → return {}
3. If role exists AND role.status === 'ACTIVE' AND role.deletedAt === null:
     for each rolePermission:
         if permission.key in SYSTEM_PERMISSION_KEY_SET:
             effective.add(key)
4. Apply user overrides:
     - DENY → effective.delete(key)
     - ALLOW → effective.add(key)
     - unknown keys (not in SYSTEM_PERMISSION_KEY_SET) are ignored
5. Return effective
```

### Precedence

| Step | Effect |
|------|--------|
| 1. Role grants | +permission |
| 2. User DENY override | −permission (always wins over role) |
| 3. User ALLOW override | +permission (only if key is valid) |

**Important:** DENY beats role ALLOW. ALLOW does NOT override role DENY (a role cannot deny a permission in the current model — only overrides can).

---

## 6. DENY vs ALLOW Precedence

Concrete examples (assuming `users.read` is a valid system permission):

| Role grants | Override | Result |
|:-----------:|:--------:|:------:|
| ✅ | none | granted |
| ✅ | DENY | **denied** (DENY wins) |
| ❌ | ALLOW | granted |
| ❌ | none | denied |
| ✅ | unknown `foo.bar` | granted (unknown keys ignored) |
| ❌ | unknown `foo.bar` | denied (unknown keys ignored) |

---

## 7. Public Methods

`EffectivePermissionsService`:

| Method | Description |
|--------|-------------|
| `getEffectivePermissionKeys(userId)` | Returns `SystemPermissionKey[]` (array form) |
| `getEffectivePermissionSet(userId)` | Returns `Set<SystemPermissionKey>` (fast lookup form) |
| `hasAllPermissions(userId, required)` | Returns `true` only if user has every required key |
| `hasAnyPermission(userId, required)` | Returns `true` if user has at least one required key |

No caching is used in this phase. Each guard call performs a focused database read.

---

## 8. Controller Mapping

| Controller | Route | Method | Decorator | Permission |
|------------|-------|:------:|-----------|------------|
| Auth | `/auth/register` | POST | `@Public()` | — |
| Auth | `/auth/login` | POST | `@Public()` | — |
| Auth | `/auth/refresh` | POST | `@Public()` | — |
| Auth | `/auth/forgot-password` | POST | `@Public()` | — |
| Auth | `/auth/reset-password` | POST | `@Public()` | — |
| Auth | `/auth/me` | GET | `@Authenticated()` | — |
| Auth | `/auth/logout` | POST | `@Authenticated()` | — |
| Auth | `/auth/logout-all` | POST | `@Authenticated()` | — |
| Auth | `/auth/change-password` | POST | `@Authenticated()` | — |
| Users | `/users` | GET | `@Permissions` | `users.read` |
| Users | `/users/:id` | GET | `@Permissions` | `users.read` |
| Users | `/users` | POST | `@Permissions` | `users.create` |
| Users | `/users/:id` | PUT | `@Permissions` | `users.update` |
| Users | `/users/:id` | DELETE | `@Permissions` | `users.delete` |
| Users | `/users/:id/status` | PUT | `@Permissions` | `users.status.update` |
| Users | `/users/:id/role` | PUT | `@Permissions` | `users.role.update` |
| Users | `/users/:id/effective-permissions` | GET | `@Permissions` | `users.permissions.read` |
| Users | `/users/:id/permission-overrides` | PUT | `@Permissions` | `users.permissions.override` |
| Roles | `/roles` | GET | `@Permissions` | `roles.read` |
| Roles | `/roles/:id` | GET | `@Permissions` | `roles.read` |
| Roles | `/roles` | POST | `@Permissions` | `roles.create` |
| Roles | `/roles/:id` | PUT | `@Permissions` | `roles.update` |
| Roles | `/roles/:id` | DELETE | `@Permissions` | `roles.delete` |
| Roles | `/roles/:id/permissions` | PUT | `@Permissions` | `roles.permissions.update` |
| Roles | `/roles/:id/duplicate` | POST | `@Permissions` | `roles.duplicate` |
| Permissions | `/permissions` | GET | `@Permissions` | `permissions.read` |
| Permissions | `/permissions/grouped` | GET | `@Permissions` | `permissions.grouped.read` |
| Permissions | `/permissions/:id` | GET | `@Permissions` | `permissions.read` |
| Audit Logs | `/audit-logs` | GET | `@Permissions` | `audit-logs.read` |
| Audit Logs | `/audit-logs` | POST | `@Permissions` | `audit-logs.create` |

**Every route is classified. There are no unclassified non-public routes.**

---

## 9. Security Behavior Examples

| Scenario | Expected |
|----------|----------|
| Public route + no token | ✅ allowed |
| Public route + valid token | ✅ allowed |
| Authenticated route + no token | ❌ 401 (JwtAuthGuard) |
| Authenticated route + valid token | ✅ allowed |
| Permission route + no token | ❌ 401 |
| Permission route + valid token + missing permission | ❌ 403 |
| Permission route + valid token + all required permissions | ✅ allowed |
| Disabled user (any token) | ❌ 401 (JwtStrategy) |
| Stale tokenVersion | ❌ 401 (JwtStrategy) |
| Unknown DB permission key in role | Ignored (not in SYSTEM_PERMISSION_KEY_SET) |
| User override DENY for granted permission | DENY wins → permission removed |
| User override ALLOW for non-granted permission (valid key) | Permission added |
| Unclassified non-public route | ❌ 403 (default-deny) |

---

## 10. What Is NOT Implemented Yet

The following are intentionally out of scope for Phase 4:

| Feature | Phase |
|---------|-------|
| Seed script (system roles + permissions) | Phase 9 |
| Super admin / role-based bypass | Phase 9+ |
| Audit logging inside use-cases | Phase 8 |
| Request logging interceptor | Phase 7 |
| Swagger / OpenAPI decorators | Phase 6 |
| Response interceptor / error filter | Phase 5 |
| Refresh token rotation reuse detection | Phase 3-R2 |
| RBAC caching (Redis / in-memory) | Future |

No hidden bypass logic exists in this phase. Super admin behavior will be implemented later as a clearly defined system role with seeded permissions — not a magic shortcut.

---

## 11. Files Created / Modified

### Created

```
src/common/rbac/
├── rbac.constants.ts
├── rbac.types.ts
├── decorators/
│   ├── public.decorator.ts
│   ├── authenticated.decorator.ts
│   └── permissions.decorator.ts
├── guards/
│   └── permissions.guard.ts
├── services/
│   └── effective-permissions.service.ts
└── rbac.module.ts
```

`src/common/rbac/index.ts` was updated to export the new APIs.

### Modified

- `src/app.module.ts` — registered both guards globally via `APP_GUARD`.
- `src/common/guards/jwt-auth.guard.ts` — already supports `@Public()` (no change needed in this phase).
- `src/modules/auth/auth.controller.ts` — all 9 routes classified.
- `src/modules/users/users.controller.ts` — all 9 routes classified.
- `src/modules/roles/roles.controller.ts` — all 7 routes classified.
- `src/modules/permissions/permissions.controller.ts` — all 3 routes classified.
- `src/modules/audit-logs/audit-logs.controller.ts` — all 2 routes classified.

---

## 12. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-06-09 | Phase 4 - Initial RBAC decorators, guards, effective permissions |
