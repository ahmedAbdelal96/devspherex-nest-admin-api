# DevSphereX Nest Admin API — Master Foundation Plan

> هذا الملف هو المرجع الأساسي لخطة بناء وإصلاح قالب الباك إند:
>
> `devspherex-nest-admin-api`
>
> الهدف: بناء NestJS Backend Starter Template قوي، منظم، قابل لإعادة الاستخدام، وقادر على حمل مشاريع CRM / ERP / HR / Clinic / Inventory / Booking / Internal Systems بأي حجم.

---

## 1. الهدف العام

نحن لا نبني مجرد مشروع NestJS عادي.

نحن نبني **Reusable Backend Starter Template** يكون نقطة انطلاق قوية لأي نظام إداري أو نظام أعمال داخلي.

القالب يجب أن يدعم من البداية:

- Authentication قوي.
- JWT access tokens.
- Refresh tokens آمنة.
- Token versioning لإبطال access tokens القديمة.
- Users management.
- Roles management.
- Permissions management.
- Direct user permission overrides.
- RBAC Guards & Decorators قابلة لإعادة الاستخدام.
- Central permissions source of truth.
- Standard API response shape.
- Standard error response shape.
- Pagination / search / sorting / filtering.
- Prisma + PostgreSQL.
- Database normalization قوية.
- Database indexes مناسبة للأداء.
- Swagger/OpenAPI بطريقة نظيفة بدون تلويث controllers.
- Logging system احترافي.
- Daily log files.
- Slow API detection.
- Audit logs قوية.
- Request tracking.
- Seed data.
- Security basics.
- Clean architecture.
- Documentation.
- QA reports لكل مرحلة.

---

## 2. القواعد الثابتة التي لا يتم كسرها

هذه القواعد تعتبر جزء من الـ architecture contract.

### 2.1 ممنوعات عامة

- ممنوع لمس أي frontend project في هذه المرحلة.
- ممنوع ربط الفرونت بالباك إند الآن.
- ممنوع استخدام MongoDB.
- ممنوع استخدام third-party auth providers مثل:
  - Clerk
  - Firebase Auth
  - Supabase Auth
  - Auth0
  - NextAuth
- ممنوع استخدام paid packages.
- ممنوع إضافة microservices في المرحلة الحالية.
- ممنوع إضافة تعقيد غير ضروري.
- ممنوع استخدام:
  - `git reset`
  - `git clean`
  - `git checkout`
  - `git pull`
  - `git push`
  - `git commit`
  إلا عند طلب صريح.
- ممنوع وضع docs أو reports في project root.
- كل docs/reports داخل `docs/`.

### 2.2 قواعد الكود

- لا يوجد fat services.
- لا يوجد business logic داخل controllers.
- Controller مسؤول عن HTTP فقط:
  - route decorators
  - guards/decorators
  - DTO validation
  - calling use cases
- كل عملية مهمة لها use-case مستقل.
- database access داخل repositories فقط.
- business protection rules داخل policies.
- response shaping داخل mappers.
- reusable domain logic داخل services صغيرة ومحددة.
- ممنوع استخدام `any` إلا عند الضرورة القصوى ومع سبب واضح.
- الكود يجب أن يكون بسيط ومقروء لأي developer يدخل المشروع.
- التعليقات تكون مفيدة وتشرح السبب أو القرار، وليس تكرارًا للكود.

---

## 3. Architecture Style

الأسلوب المعتمد:

## Practical Clean Modular Architecture

ليس DDD تقيل، وليس service-based عشوائي.

داخل كل module:

```txt
modules/{module-name}/
  dto/
  use-cases/
  repositories/
  policies/
  mappers/
  services/
  swagger/
  {module-name}.controller.ts
  {module-name}.module.ts
```

### 3.1 Controllers

Controllers تكون قصيرة جدًا.

مثال جيد:

```ts
@Get()
@UsersSwagger.list()
@Permissions(PERMISSIONS.USERS.READ.key)
list(@Query() query: ListUsersQueryDto) {
  return this.listUsersUseCase.execute(query);
}
```

### 3.2 Use Cases

كل operation لها use-case:

```txt
create-user.use-case.ts
list-users.use-case.ts
update-user.use-case.ts
delete-user.use-case.ts
update-user-status.use-case.ts
update-user-role.use-case.ts
get-user-effective-permissions.use-case.ts
update-user-permission-overrides.use-case.ts
```

### 3.3 Repositories

Repositories مسؤولة عن Prisma queries فقط.

ممنوع داخل repository:

- HTTP logic
- response formatting
- permission decisions
- business protection decisions

### 3.4 Policies

Policies مسؤولة عن قواعد المنع والحماية.

أمثلة:

- منع حذف system role.
- منع حذف آخر Super Admin.
- منع المستخدم من تعطيل نفسه.
- منع تغيير role لنفسه.
- منع حذف role عليه users.
- منع تعديل Super Admin بطريقة غير آمنة.

### 3.5 Mappers

Mappers مسؤولة عن تجهيز شكل response.

أهم قاعدة:

- ممنوع رجوع `passwordHash`.
- ممنوع رجوع token hashes.
- ممنوع رجوع internal secrets.

### 3.6 Services

Services تكون صغيرة ومحددة.

أمثلة:

```txt
password.service.ts
token.service.ts
refresh-token.service.ts
effective-permissions.service.ts
audit-logging.service.ts
```

---

## 4. Swagger Architecture

Swagger لا يوضع بشكل عشوائي داخل controllers.

لكل module ملف swagger مستقل:

```txt
modules/auth/swagger/auth.swagger.ts
modules/users/swagger/users.swagger.ts
modules/roles/swagger/roles.swagger.ts
modules/permissions/swagger/permissions.swagger.ts
modules/audit-logs/swagger/audit-logs.swagger.ts
```

مثال:

```ts
export const UsersSwagger = {
  list: () =>
    applyDecorators(
      ApiOperation({ summary: 'List users' }),
      ApiOkResponse({ description: 'Users returned successfully' }),
      ApiBearerAuth(),
    ),

  create: () =>
    applyDecorators(
      ApiOperation({ summary: 'Create user' }),
      ApiCreatedResponse({ description: 'User created successfully' }),
      ApiBearerAuth(),
    ),
};
```

داخل controller:

```ts
@Get()
@UsersSwagger.list()
@Permissions(PERMISSIONS.USERS.READ.key)
list() {}
```

### Acceptance Criteria

- controllers نظيفة.
- Swagger decorators في ملفات `swagger/`.
- Swagger URL:
  - `/api/docs`
- DTOs موثقة.
- tags منظمة.
- Bearer Auth واضح.

---

## 5. Central Permissions Source of Truth

هذه نقطة أساسية جدًا.

لا يتم جمع الصلاحيات من controllers أو modules.

يجب وجود ملف واحد هو المصدر الأساسي لصلاحيات النظام:

```txt
src/common/rbac/system-permissions.ts
```

مثال:

```ts
export const SYSTEM_PERMISSIONS = {
  USERS: {
    READ: {
      key: 'users.read',
      resource: 'users',
      action: 'read',
      label: 'View users',
      group: 'Users',
    },
    CREATE: {
      key: 'users.create',
      resource: 'users',
      action: 'create',
      label: 'Create users',
      group: 'Users',
    },
  },
  ROLES: {
    READ: {
      key: 'roles.read',
      resource: 'roles',
      action: 'read',
      label: 'View roles',
      group: 'Roles',
    },
  },
} as const;
```

### قواعد مهمة

- ممنوع hardcoded permission strings داخل controllers.
- seed يقرأ من نفس الملف.
- Swagger/docs يمكن أن تشير لنفس المفاتيح.
- guards تستخدم نفس المفاتيح.
- أي module جديد يضيف صلاحياته في نفس الملف.
- لو النظام وصل 300 module، نقدر نعرف كل الصلاحيات من مكان واحد.

### استخدام صحيح

```ts
@Permissions(PERMISSIONS.USERS.READ.key)
```

أو:

```ts
@Permissions(SYSTEM_PERMISSION_KEYS.USERS.READ)
```

### استخدام مرفوض

```ts
@Permissions('users.read')
```

---

## 6. RBAC Requirements

### 6.1 Decorators

```txt
src/common/decorators/public.decorator.ts
src/common/decorators/permissions.decorator.ts
src/common/decorators/current-user.decorator.ts
```

### 6.2 Guards

```txt
src/common/guards/jwt-auth.guard.ts
src/common/guards/permissions.guard.ts
```

### 6.3 Effective Permissions Logic

المنطق النهائي:

```txt
effective permissions =
role permissions
+ direct allow permissions
- direct deny permissions
```

### 6.4 Direct Deny Priority

لو permission موجودة في role وموجودة direct deny للمستخدم، direct deny تكسب.

### 6.5 Super Admin

الأفضل أن Super Admin يكون لديه كل permissions seeded بشكل واضح، وليس magic غير مرئي.

ممكن لاحقًا نضيف shortcut داخلي، لكن الأساس يكون واضح ومفهوم.

---

## 7. Authentication Security

### 7.1 Access Token Payload

يجب أن يحتوي access token على:

```ts
{
  sub: user.id,
  email: user.email,
  roleId: user.roleId,
  tokenVersion: user.tokenVersion
}
```

### 7.2 Token Versioning

`User.tokenVersion` مهم جدًا.

كل request محمي يجب أن يقارن:

```txt
payload.tokenVersion === user.tokenVersion
```

لو غير مطابق:

```txt
Unauthorized
```

### 7.3 متى نعمل increment tokenVersion؟

يتم زيادة `tokenVersion` عند:

- logout إذا أردنا إبطال access token الحالي فورًا.
- logout all.
- change password.
- reset password.
- disable user.
- تغيير email.
- تغيير role بشكل حساس.
- أي security-sensitive action.

### 7.4 Logout

```txt
POST /api/v1/auth/logout
```

يفعل:

- revoke refresh token الحالي.
- increment tokenVersion للمستخدم.

### 7.5 Logout All

```txt
POST /api/v1/auth/logout-all
```

يفعل:

- revoke all refresh tokens.
- increment tokenVersion.

### 7.6 Change Password

يفعل:

- verify current password.
- update passwordHash.
- revoke all refresh tokens.
- increment tokenVersion.
- audit log.

### 7.7 Disabled User

لو admin عطّل user:

- status becomes `disabled`.
- increment tokenVersion.
- revoke all refresh tokens.
- user لا يستطيع استخدام access token قديم.

---

## 8. Refresh Token Design

المطلوب:

- raw refresh token يرجع للعميل مرة واحدة.
- لا يتم تخزين raw token في DB.
- يتم تخزين hash فقط.
- refresh token rotation.
- revoke old token عند refresh.
- return new access token + new refresh token.
- support token family / jti لتتبع reuse.

### RefreshToken Model

```txt
id
userId
tokenHash
jti
familyId
expiresAt
revokedAt
replacedByTokenId
createdAt
```

### Indexes

```txt
jti unique
userId
familyId
expiresAt
revokedAt
```

---

## 9. Database Contract

قاعدة البيانات PostgreSQL + Prisma.

### 9.1 User

```txt
id
name
email
passwordHash
avatarUrl optional
phone optional
status: active | disabled | pending
roleId
tokenVersion
lastLoginAt optional
createdAt
updatedAt
deletedAt optional
```

### 9.2 Role

```txt
id
name
slug
description optional
status
isSystem
createdAt
updatedAt
deletedAt optional
```

### 9.3 Permission

```txt
id
key
resource
action
label
description optional
group
isSystem
createdAt
updatedAt
```

### 9.4 RolePermission

```txt
roleId
permissionId
createdAt
```

### 9.5 UserPermissionOverride

```txt
userId
permissionId
effect: allow | deny
createdAt
```

### 9.6 RefreshToken

```txt
id
userId
tokenHash
jti
familyId
expiresAt
revokedAt optional
replacedByTokenId optional
createdAt
```

### 9.7 AuditLog

```txt
id
actorId optional
action
entity
entityId optional
metadata JSON optional
ip optional
userAgent optional
requestId optional
createdAt
```

### 9.8 ApiRequestLog

```txt
id
requestId
actorId optional
method
path
statusCode
durationMs
ip
userAgent
requestBody JSON optional
query JSON optional
params JSON optional
responseError JSON optional
createdAt
```

---

## 10. Database Normalization Rules

- لا يتم تخزين permissions كـ JSON array داخل user أو role.
- لا يتم تخزين permissions كـ comma-separated string.
- Role permissions من خلال join table.
- User permission overrides من خلال join table مستقلة.
- Refresh tokens في جدول مستقل.
- Audit logs في جدول مستقل.
- Request logs في جدول مستقل.
- Soft delete للـ users/roles بدل hard delete.
- `deletedAt` يدخل في queries الافتراضية.

---

## 11. Database Index Strategy

### User Indexes

```txt
email unique
status
roleId
deletedAt
createdAt
[status, roleId, createdAt]
```

### Role Indexes

```txt
slug unique
status
isSystem
deletedAt
createdAt
```

### Permission Indexes

```txt
key unique
resource
action
group
[resource, action]
```

### RolePermission Indexes

```txt
[roleId, permissionId] unique
roleId
permissionId
```

### UserPermissionOverride Indexes

```txt
[userId, permissionId] unique
userId
permissionId
effect
```

### RefreshToken Indexes

```txt
jti unique
userId
familyId
expiresAt
revokedAt
[userId, revokedAt]
```

### AuditLog Indexes

```txt
actorId
action
entity
entityId
createdAt
[entity, entityId, createdAt]
[action, createdAt]
[actorId, createdAt]
```

### ApiRequestLog Indexes

```txt
requestId unique
actorId
path
statusCode
durationMs
createdAt
[path, createdAt]
[statusCode, createdAt]
[actorId, createdAt]
```

### بحث ملايين الصفوف

لو الداتا كبرت جدًا، يمكن لاحقًا إضافة:

- PostgreSQL trigram indexes للبحث النصي.
- full-text search.
- cursor pagination للصفحات الكبيرة.
- archiving strategy للـ logs القديمة.

لا نضيف تعقيد مبكر إلا لو مطلوب.

---

## 12. Standard API Response

### Success

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

### Error

```json
{
  "success": false,
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "errors": []
}
```

### Required Files

```txt
src/common/interceptors/response.interceptor.ts
src/common/filters/http-exception.filter.ts
src/common/dto/api-response.dto.ts
src/common/dto/pagination-meta.dto.ts
src/common/utils/pagination.util.ts
```

---

## 13. Pagination / Search / Sorting / Filtering

Standard query:

```txt
?page=1&limit=10&search=abc&sortBy=createdAt&sortOrder=desc
```

### Rules

- page minimum 1.
- limit maximum محدد حسب endpoint.
- sortBy must be whitelisted.
- sortOrder only `asc` or `desc`.
- search لا يستخدم على كل الأعمدة بشكل عشوائي.
- filtering واضح ومفهرس.
- في الجداول الكبيرة نستخدم cursor pagination لاحقًا إن لزم.

---

## 14. Logging System

نحتاج logging قوي بدون تعقيد مفرط.

### أهداف logging

- معرفة كل request دخل النظام.
- معرفة كل error.
- معرفة APIs البطيئة.
- معرفة actorId إن وجد.
- معرفة requestId لتتبع المشكلة.
- ملفات يومية.
- ألوان واضحة في development.
- إخفاء secrets.

### Preferred Approach

استخدام logging سريع ومنظم مثل Pino أو Winston.

المهم:

- colored console logs في development.
- daily log files.
- JSON logs قابلة للتحليل.
- redaction للبيانات الحساسة.

### Required Files

```txt
src/common/logging/logger.module.ts
src/common/logging/logger.service.ts
src/common/logging/request-context.middleware.ts
src/common/logging/request-logging.interceptor.ts
src/common/logging/slow-request.interceptor.ts
src/common/logging/log-redaction.util.ts
```

### Log Fields

```txt
requestId
method
path
statusCode
durationMs
actorId
ip
userAgent
errorCode
timestamp
```

### Log Files

```txt
logs/app/YYYY-MM-DD.log
logs/error/YYYY-MM-DD.log
logs/http/YYYY-MM-DD.log
logs/audit/YYYY-MM-DD.log
```

### .gitignore

```txt
logs/
*.log
```

### Slow Request

من خلال env:

```txt
SLOW_REQUEST_THRESHOLD_MS=1000
```

أي API يتخطى threshold يتم تسجيله warning.

---

## 15. Audit System

Audit logs ليست نفس request logs.

### Request Log

يسجل HTTP details:

- method
- path
- status
- duration
- ip
- userAgent
- actorId
- requestId

### Audit Log

يسجل business/security action:

- login
- failed login
- logout
- logout all
- password changed
- password reset requested
- user created
- user updated
- user disabled
- user role changed
- user permission overrides updated
- role created
- role updated
- role deleted
- role permissions updated
- refresh token reuse detected

### AuditLog Example

```json
{
  "actorId": "admin-id",
  "action": "users.status.updated",
  "entity": "users",
  "entityId": "target-user-id",
  "metadata": {
    "from": "active",
    "to": "disabled"
  },
  "ip": "127.0.0.1",
  "userAgent": "Mozilla/5.0",
  "requestId": "req-id",
  "createdAt": "2026-06-09T00:00:00.000Z"
}
```

### Rules

- ممنوع تخزين passwords.
- ممنوع تخزين tokens.
- metadata تكون sanitized.
- كل mutation مهم يسجل audit.
- requestId يربط audit log بـ request log.

---

## 16. Seed System

Seed must be idempotent.

### Required File

```txt
prisma/seed.ts
```

### Seed Sources

Permissions must be seeded from:

```txt
src/common/rbac/system-permissions.ts
```

### Seed Data

Roles:

```txt
Super Admin
Admin
Manager
Staff
Viewer
```

Permissions:

- users.read
- users.create
- users.update
- users.delete
- roles.read
- roles.create
- roles.update
- roles.delete
- permissions.read
- permissions.assign
- settings.read
- settings.update
- auditLogs.read

ثم يتم التوسع لاحقًا من نفس source of truth.

### Default Admin Env

```txt
DEFAULT_ADMIN_NAME
DEFAULT_ADMIN_EMAIL
DEFAULT_ADMIN_PASSWORD
```

### Rules

- لا duplicate عند تشغيل seed أكثر من مرة.
- Super Admin يحصل على كل permissions.
- password يتم hash.
- لا secrets hardcoded.

---

## 17. Security Hardening

### Required

- Helmet.
- CORS من env.
- Rate limiting.
- Global ValidationPipe.
- Global ExceptionFilter.
- Global ResponseInterceptor.
- Env validation.
- No default production secrets.
- Password policy.
- Redaction للبيانات الحساسة.
- Request body limit.
- Throttle خاص للـ login / forgot password / reset password.

### Env Validation

لازم التطبيق يرفض التشغيل في production لو:

- JWT_SECRET default.
- DATABASE_URL missing.
- DEFAULT_ADMIN_PASSWORD ضعيف وقت seed.
- CORS مفتوح بدون قصد.

---

## 18. Main API Endpoints

### Auth

```txt
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/logout-all
POST /api/v1/auth/refresh
GET  /api/v1/auth/me
POST /api/v1/auth/change-password
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
```

### Users

```txt
GET    /api/v1/users
GET    /api/v1/users/:id
POST   /api/v1/users
PATCH  /api/v1/users/:id
DELETE /api/v1/users/:id
PATCH  /api/v1/users/:id/status
PATCH  /api/v1/users/:id/role
GET    /api/v1/users/:id/effective-permissions
PATCH  /api/v1/users/:id/permission-overrides
```

### Roles

```txt
GET    /api/v1/roles
GET    /api/v1/roles/:id
POST   /api/v1/roles
PATCH  /api/v1/roles/:id
DELETE /api/v1/roles/:id
PATCH  /api/v1/roles/:id/permissions
POST   /api/v1/roles/:id/duplicate
```

### Permissions

```txt
GET /api/v1/permissions
GET /api/v1/permissions/grouped
GET /api/v1/permissions/:id
```

### Audit Logs

```txt
GET /api/v1/audit-logs
```

### Request Logs

```txt
GET /api/v1/request-logs
GET /api/v1/request-logs/slow
GET /api/v1/request-logs/errors
```

---

## 19. Documentation Required

كل docs داخل `docs/`.

```txt
docs/implementation/
docs/api/
docs/qa/
docs/database/
docs/architecture/
```

### Files

```txt
docs/implementation/phase-x.md
docs/qa/phase-x-qa-report.md
docs/api/auth-api-contract.md
docs/api/users-api-contract.md
docs/api/rbac-api-contract.md
docs/api/audit-api-contract.md
docs/api/request-logs-api-contract.md
docs/database/schema-contract.md
docs/architecture/project-structure.md
docs/architecture/logging-and-audit.md
docs/architecture/security-model.md
```

---

## 20. Phase Execution Strategy

لا يتم تنفيذ كل شيء مرة واحدة.

كل Phase صغيرة ومستقلة.

بعد كل Phase:

1. Agent ينفذ المطلوب فقط.
2. يعمل validation commands.
3. يكتب QA report.
4. يرفع commit فقط عند طلب صريح.
5. أحمد يرسل التغييرات للمراجعة.
6. تتم مراجعة الكود قبل المرحلة التالية.

---

# 21. Execution Phases

## Phase 0 — Current State Review

هدفها inspection فقط.

لا implementation.

### Scope

- مراجعة current repository.
- تشغيل commands.
- كتابة QA report.

### Commands

```bash
npm install
npm run build
npx prisma validate
npm run lint
```

### Output

```txt
docs/qa/phase-0-current-state-review.md
```

### Acceptance Criteria

- لا schema changes.
- لا feature implementation.
- report صادق.
- errors لا يتم إخفاؤها.

---

## Phase 1 — Prisma Schema & Database Contract

### Scope

- إصلاح Prisma schema.
- إضافة missing fields.
- إضافة enums.
- إضافة tokenVersion.
- إضافة RefreshToken design الصحيح.
- إضافة UserPermissionOverride.effect.
- إضافة ApiRequestLog.
- إضافة indexes.

### Output

```txt
docs/database/schema-contract.md
docs/qa/phase-1-database-contract-qa-report.md
```

### Validation

```bash
npx prisma validate
npm run build
```

---

## Phase 2 — Central Permissions Source of Truth

### Scope

- إنشاء `system-permissions.ts`.
- منع hardcoded permission strings.
- تجهيز seed ليقرأ من source of truth لاحقًا.
- إضافة helper لاستخراج permission keys.

### Output

```txt
src/common/rbac/system-permissions.ts
src/common/rbac/permission-keys.ts
docs/api/rbac-api-contract.md
```

---

## Phase 3 — Auth Token Security & Token Versioning

### Scope

- access token payload يحتوي tokenVersion.
- JwtStrategy يقارن tokenVersion.
- logout يبطل access token.
- logout-all.
- change-password يبطل tokens.
- disable user يبطل tokens.
- refresh token rotation.

### Output

```txt
docs/architecture/security-model.md
docs/qa/phase-3-auth-token-security-qa-report.md
```

---

## Phase 4 — RBAC Decorators, Guards & Effective Permissions

### Scope

- `@Public()`
- `@Permissions()`
- `PermissionsGuard`
- effective permissions service.
- allow/deny logic.
- حماية كل admin endpoints.

### Output

```txt
docs/api/rbac-api-contract.md
docs/qa/phase-4-rbac-qa-report.md
```

---

## Phase 5 — Standard API Response & Error Handling

### Scope

- response interceptor.
- exception filter.
- validation errors.
- Prisma errors.
- pagination meta.

### Output

```txt
docs/api/standard-response-contract.md
docs/qa/phase-5-response-errors-qa-report.md
```

---

## Phase 6 — Swagger Clean Decorators

### Scope

- Swagger setup.
- `/api/docs`.
- Swagger decorators في ملفات منفصلة لكل module.
- controllers تظل نظيفة.

### Output

```txt
docs/api/swagger-contract.md
docs/qa/phase-6-swagger-qa-report.md
```

---

## Phase 7 — Logging System

### Scope

- structured logger.
- colored console logs.
- daily files.
- slow API logging.
- requestId.
- redaction.

### Output

```txt
docs/architecture/logging-and-audit.md
docs/qa/phase-7-logging-qa-report.md
```

---

## Phase 8 — Audit Logs & Request Tracking

### Scope

- AuditLog service.
- ApiRequestLog model integration.
- Request logging interceptor/middleware.
- audit actions inside use-cases.
- endpoints for logs.

### Output

```txt
docs/api/audit-api-contract.md
docs/api/request-logs-api-contract.md
docs/qa/phase-8-audit-request-tracking-qa-report.md
```

---

## Phase 9 — Seed & Admin Bootstrap

### Scope

- `prisma/seed.ts`
- permissions from system-permissions.
- roles seed.
- default admin.
- idempotent seed.

### Output

```txt
docs/database/seed-contract.md
docs/qa/phase-9-seed-qa-report.md
```

---

## Phase 10 — Users/Roles/Permissions APIs Finalization

### Scope

- endpoints final contract.
- PATCH usage.
- soft delete.
- list filters/sorting.
- permission overrides allow/deny.
- role slug.
- system role protection.
- Super Admin protection.

### Output

```txt
docs/api/users-api-contract.md
docs/api/roles-api-contract.md
docs/api/permissions-api-contract.md
docs/qa/phase-10-core-admin-apis-qa-report.md
```

---

## Phase 11 — Security Hardening

### Scope

- Helmet.
- CORS env config.
- rate limiting.
- env validation.
- login throttling.
- password policy.
- request body limit.
- production safety checks.

### Output

```txt
docs/architecture/security-model.md
docs/qa/phase-11-security-hardening-qa-report.md
```

---

## Phase 12 — Final Docs & QA Cleanup

### Scope

- مراجعة كل docs.
- التأكد من project structure.
- clean root.
- final build/lint/test/prisma validate.
- final checklist.

### Output

```txt
docs/qa/final-foundation-qa-report.md
README.md
```

---

## 22. Final Validation Commands

في نهاية كل phase حسب الحاجة:

```bash
npm run build
npm run lint
npm run test
npx prisma validate
```

إذا قاعدة البيانات متاحة:

```bash
npx prisma migrate dev
npx prisma db seed
```

---

## 23. Definition of Done للـ Template Foundation

لا نعتبر الـ foundation جاهز إلا عندما:

- Prisma schema مطابق للcontract.
- DB normalized.
- indexes أساسية موجودة.
- tokenVersion يعمل.
- refresh token آمن.
- RBAC يعمل من source of truth واحد.
- direct allow/deny يعمل.
- كل admin endpoints محمية بصلاحيات.
- response shape موحد.
- errors موحدة.
- Swagger شغال ونظيف.
- logging system شغال.
- audit logs شغالة.
- request tracking شغال.
- seed idempotent.
- docs كاملة.
- build/lint/prisma validate ناجحين.
- لا توجد TODOs خطيرة في auth/security/RBAC.
- لا توجد hardcoded secrets.
- لا توجد permission strings عشوائية في controllers.

---

## 24. مراجعة كل Commit

بعد كل commit:

- لا يتم دخول phase جديدة قبل مراجعة الكود.
- يتم فحص:
  - الملفات المعدلة.
  - هل التزم بالscope؟
  - هل كسر architecture؟
  - هل أضاف complexity غير مطلوب؟
  - هل build/prisma validate ناجحين؟
  - هل docs/QA report موجود؟
  - هل في security regression؟
  - هل في hardcoded values؟
  - هل controllers نظيفة؟
  - هل permissions من source of truth؟
  - هل indexes مناسبة؟
  - هل code readable؟

---

## 25. ملاحظات مهمة للمستقبل

- هذا القالب ليس CRM ولا ERP بحد ذاته.
- هذا القالب هو core admin backend foundation.
- Modules المستقبلية مثل CRM / Inventory / Clinic / Booking يجب أن تتبع نفس architecture.
- أي module جديد يجب أن:
  - يضيف permissions في system-permissions.
  - يضيف DTOs.
  - يضيف use-cases.
  - يضيف repositories.
  - يضيف policies عند الحاجة.
  - يضيف mappers.
  - يضيف swagger file.
  - يضيف audit actions للmutations المهمة.
  - يحترم response/error shape.
  - يضيف indexes مناسبة لو فيه جداول جديدة.

---

## 26. الخلاصة

هذه الخطة هي المرجع الأساسي.

لا نتحرك بسرعة على حساب الجودة.

الهدف ليس أن ينتهي المشروع بسرعة، بل أن يكون foundation محترم يمكن البناء عليه لسنوات.

أي AI Agent يجب أن يعمل phase واحدة فقط في كل مرة، ولا ينتقل للمرحلة التالية قبل مراجعة أحمد ومراجعة الكود.
