# RBAC Guards & Decorators Contract

## Phase 4-R1 - RBAC Security Gate Hardening & Verification

---

## 1. Security Model

The project uses a **default-deny** RBAC protection layer for the entire API.

Every endpoint MUST be explicitly classified into one of four categories using a decorator. An unclassified non-public route is automatically denied at runtime.

| Classification | Decorator | JWT Required | Permission Required |
|---------------|-----------|:------------:|:-------------------:|
| Public | `@Public()` | ❌ | ❌ |
| Authenticated-only | `@Authenticated()` | ✅ | ❌ |
| Permission-protected (ALL) | `@Permissions(...)` | ✅ | ✅ (all) |
| Permission-protected (ANY) | `@AnyPermissions(...)` | ✅ | ✅ (at least one) |

If a non-public route has **none** of these decorators, the `PermissionsGuard` throws `ForbiddenException` with message `Access denied: route requires explicit classification`.

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

**Implementation:** simple `SetMetadata(IS_PUBLIC_KEY, true)` wrapper.

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

**Implementation:** simple `SetMetadata(IS_AUTHENTICATED_KEY, true)` wrapper.

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

**Implementation (R1):** uses NestJS `applyDecorators` for clean, declarative composition:

```ts
export const Permissions = (...permissions: SystemPermissionKey[]) => {
  for (const permission of permissions) {
    assertValidSystemPermissionKey(permission);
  }
  return applyDecorators(
    SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions),
    SetMetadata(PERMISSION_MODE_KEY, 'all' as PermissionMode),
  );
};
```

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

**Implementation (R1):** same `applyDecorators` pattern as `@Permissions` with `'any'` mode.

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

## 5. Metadata Override Rule

`Reflector.getAllAndOverride` is used in both guards. The override order is:

- **Handler-level metadata overrides class-level metadata.**

This means if a class is decorated with `@Permissions(A)` and a method on that class is decorated with `@Permissions(B)`, the method will be evaluated against `B` only. There is no merging across levels — the handler wins.

---

## 6. Effective Permissions Calculation

`EffectivePermissionsService` computes a `Set<SystemPermissionKey>` for a given `userId`.

### Algorithm (R1 — DENY hardened)

```
effective = new Set<SystemPermissionKey>()

1. Load user (with role and role.permissions, permissionOverrides)
2. If user not found OR user.status !== 'ACTIVE' → return effective (empty)
3. If role exists AND role.status === 'ACTIVE' AND role.deletedAt === null:
     for each rolePermission:
         if permission.key in SYSTEM_PERMISSION_KEY_SET:
             effective.add(key)
4. Collect allowOverrideKeys (only keys in SYSTEM_PERMISSION_KEY_SET)
5. Collect denyOverrideKeys  (only keys in SYSTEM_PERMISSION_KEY_SET)
6. Apply ALLOW overrides (additive):
     for each key in allowOverrideKeys: effective.add(key)
7. Apply DENY overrides LAST:
     for each key in denyOverrideKeys: effective.delete(key)
```

### Precedence

| Step | Effect |
|------|--------|
| 1. Role grants | +permission |
| 2. User ALLOW override | +permission |
| 3. User DENY override | −permission (applied LAST) |

**DENY always wins** — even if a key appears in role grants, in ALLOW overrides, or both. The DENY step runs last and removes the key.

### Edge cases

- **Disabled / pending user** → empty set.
- **User without a role** → only overrides apply.
- **Disabled or soft-deleted role** → role permissions are ignored.
- **Unknown DB keys** (not in `SYSTEM_PERMISSION_KEY_SET`) → silently ignored. This protects against stale or manually corrupted entries.
- **No super-admin bypass.** There is no hidden shortcut for any user, role, or email.

---

## 7. DENY vs ALLOW Precedence Examples

Assuming `users.read` is a valid system permission:

| Role grants | ALLOW | DENY | Final Result |
|:-----------:|:-----:|:----:|:------------:|
| ✅ | — | — | granted |
| ✅ | — | ✅ | **denied** (DENY wins) |
| ❌ | ✅ | — | granted |
| ❌ | ✅ | ✅ | **denied** (DENY wins) |
| ✅ | ✅ | ✅ | **denied** (DENY wins) |
| ❌ | — | — | denied |
| ✅ | unknown `foo.bar` | — | granted (unknown ignored) |
| ❌ | unknown `foo.bar` | unknown `foo.bar` | denied (unknown ignored) |

---

## 8. Public Methods

`EffectivePermissionsService`:

| Method | Description |
|--------|-------------|
| `getEffectivePermissionKeys(userId)` | Returns `SystemPermissionKey[]` (array form) |
| `getEffectivePermissionSet(userId)` | Returns `Set<SystemPermissionKey>` (fast lookup form) |
| `hasAllPermissions(userId, required)` | Returns `true` only if user has every required key |
| `hasAnyPermission(userId, required)` | Returns `true` if user has at least one required key |

No caching is used in this phase. Each guard call performs a focused database read.

---

## 9. RBAC Module Dependency Wiring

`RbacModule` (R1) intentionally does **not** redeclare `PrismaService`:

```ts
@Module({
  providers: [EffectivePermissionsService],
  exports: [EffectivePermissionsService],
})
export class RbacModule {}
```

**Reason:** `DatabaseModule` (`src/common/database/database.module.ts`) is registered as a `@Global()` module and already provides `PrismaService`. Declaring `PrismaService` again in `RbacModule` would create a duplicate provider pattern with no functional benefit. Since `DatabaseModule` is global, `EffectivePermissionsService` (and any other provider in the application) can inject `PrismaService` directly.

`PermissionsGuard` is **not** registered in `RbacModule`. It is registered globally in `AppModule` via `APP_GUARD` so it shares the correct ordering with `JwtAuthGuard`.

---

## 10. Controller Mapping

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

## 11. Security Behavior Examples

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
| Both ALLOW and DENY for same key | DENY wins (applied last) |
| Unclassified non-public route | ❌ 403 (default-deny) |
| Disabled / soft-deleted role | Role permissions ignored |
| User without role | Only overrides apply |

---

## 12. No-Bypass Verification

The following checks were performed and confirmed:

- ✅ No `superAdmin` bypass.
- ✅ No role-name bypass (`if user.role.name === 'admin'`).
- ✅ No email-based bypass.
- ✅ No environment-based bypass.
- ✅ No guard disabled globally.
- ✅ No skip of RBAC other than `@Public()`.

The only legitimate "bypass" is `@Public()`, which must be explicitly attached to a route. Every non-public route must be classified or it is denied.

---

## 13. What Is NOT Implemented Yet

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

---

## 14. Files

```
src/common/rbac/
├── index.ts
├── rbac.constants.ts
├── rbac.types.ts
├── rbac.module.ts
├── system-permissions.ts
├── permission.types.ts
├── permission.utils.ts
├── decorators/
│   ├── public.decorator.ts
│   ├── authenticated.decorator.ts
│   └── permissions.decorator.ts
├── guards/
│   └── permissions.guard.ts
└── services/
    └── effective-permissions.service.ts
```

---

## 15. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.1.0 | 2026-06-09 | R1 - Decorators use `applyDecorators`; DENY hardening (applied last); RbacModule no longer redeclares PrismaService; metadata override rule documented; no-bypass verification section added |
| 1.0.0 | 2026-06-09 | Phase 4 - Initial RBAC decorators, guards, effective permissions |
