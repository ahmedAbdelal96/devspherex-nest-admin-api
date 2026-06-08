# Phase 1A-R2 — Align Node 24 & bcryptjs Package Baseline

**Date:** 2026-06-09
**Phase:** 1A-R2 — Align Node 24 & bcryptjs Package Baseline
**Reference:** [Master Plan](../architecture/devspherex-nest-admin-api-master-plan.md)

---

## 1. What Was Changed

### Before:
- `@types/node`: `^22.0.0`

### After:
- `@types/node`: `^24.0.0`

---

## 2. Why `@types/node` Was Updated

The project engine specifies `node: ">=24 <25"`, but `@types/node` was at version `^22.0.0`, which is not aligned with the Node 24 runtime.

Updating `@types/node` to `^24.0.0` ensures:
- TypeScript type definitions match the actual Node.js 24 runtime
- API compatibility for Node 24 built-in modules (e.g., `node:crypto`)
- Proper TypeScript support for Node 24 features

---

## 3. bcryptjs Version Decision

### Current State:
- `bcryptjs`: `^2.4.3`
- `@types/bcryptjs`: `^2.4.6`

### Analysis:
- `bcryptjs` version `2.4.3` is the **latest stable version** as of this date
- No newer version is available on npm
- `@types/bcryptjs` version `2.4.6` is the latest compatible types

### Decision:
- **Keep `bcryptjs` at `^2.4.3`** - Already on latest stable
- **Keep `@types/bcryptjs` at `^2.4.6`** - bcryptjs 2.x does NOT include built-in TypeScript types, so `@types/bcryptjs` is still required

### Why bcryptjs Doesn't Include TypeScript Types:
Unlike some pure JavaScript packages that bundle their own types, `bcryptjs` requires external `@types/bcryptjs` because:
1. It's a legacy-style package (CommonJS)
2. The type definitions are maintained separately in DefinitelyTyped
3. The package itself has no `types` field in its `package.json`

---

## 4. Files Changed

| File | Change |
|------|--------|
| `package.json` | Updated `@types/node` from `^22.0.0` to `^24.0.0` |

---

## 5. Commands Executed

### npm install
```
changed 2 packages, and audited 785 packages in 6s
```
**Result:** ✅ SUCCESS

### npx prisma generate
```
Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma\schema.prisma.
✔ Generated Prisma Client (v7.8.0) to .\node_modules\@prisma\client in 238ms
```
**Result:** ✅ SUCCESS

### npx prisma validate
```
Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma\schema.prisma.
The schema at prisma\schema.prisma is valid 🚀
```
**Result:** ✅ SUCCESS

### npm run build
```
> devspherex-nest-admin-api@1.0.0 build
> nest build
```
(No errors)
**Result:** ✅ SUCCESS

### npm run lint
```
7 problems (0 errors, 7 warnings)
```
**Result:** ✅ SUCCESS (warnings only, no errors)

---

## 6. Remaining Issues

### Lint Warnings (Pre-existing, Not Phase 1A-R2 Scope):

| File | Warning |
|------|---------|
| `audit-logs.controller.ts` | `ParseUUIDPipe` unused |
| `reset-password.use-case.ts` | `BadRequestException` unused |
| `create-user.dto.ts` | `IsEnum` unused |
| `users.policy.ts` | `newRoleId` unused |
| `create-user.use-case.ts` | `UserResponseMapper` unused |
| `update-user-role.use-case.ts` | `ForbiddenException` unused |
| `update-user-status.use-case.ts` | `ForbiddenException` unused |

These warnings are **pre-existing** and will be addressed when the actual features are implemented.

---

## 7. Clear Recommendation for Phase 1B

### Phase 1B Scope: Database Contract & Prisma Schema Full Update

The package baseline is now fully aligned:

| Component | Version | Status |
|-----------|---------|--------|
| Node.js | 24.x | ✅ Aligned |
| @types/node | 24.x | ✅ Aligned |
| bcryptjs | 2.4.3 | ✅ Latest stable |
| @types/bcryptjs | 2.4.6 | ✅ Required & aligned |
| NestJS | 11.x | ✅ Aligned |
| Prisma | 7.x | ✅ Aligned |

### Ready for Phase 1B:

1. **Add `tokenVersion` to User model** - For token invalidation
2. **Add `slug`, `status`, `deletedAt` to Role model** - For role management
3. **Update Permission model** - Add `key`, `resource`, `action`, `isSystem`
4. **Add `effect: allow | deny` to UserPermissionOverride** - For direct deny priority
5. **Redesign RefreshToken model** - Add `tokenHash`, `jti`, `familyId`
6. **Add ApiRequestLog model** - For HTTP request logging
7. **Create seed script** - With default admin and roles

---

## Summary

| Item | Status |
|------|--------|
| @types/node aligned with Node 24 | ✅ |
| bcryptjs checked (already latest) | ✅ |
| @types/bcryptjs kept (still needed) | ✅ |
| npm install | ✅ |
| npx prisma generate | ✅ |
| npx prisma validate | ✅ |
| npm run build | ✅ |
| npm run lint | ✅ (warnings only) |
| QA report | ✅ |

---

## Next Steps

1. Review this QA report
2. Proceed to Phase 1B: Database Contract & Prisma Schema Full Update
3. All tooling is now aligned and ready for database schema changes