# OpenAPI / Swagger Contract

## Overview

This API exposes a Swagger UI at `/docs` (JSON at `/docs-json`) when `SWAGGER_ENABLED=true`. All endpoints are documented with the Phase 6 `ApiSuccessResponse<T>` / `ApiErrorResponse` envelope, bearer authentication, and consistent error responses.

---

## Enabling Swagger

```bash
SWAGGER_ENABLED=true npm run start:dev
```

Swagger is available at:
- **UI:** `http://localhost:3000/docs`
- **JSON:** `http://localhost:3000/docs-json`

Authorization is persisted across page refreshes via `persistAuthorization: true`.

---

## Response Envelope

All documented responses follow the Phase 6 envelope:

### Success

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {},
  "meta": {
    "requestId": "a1b2c3d4e5f6...",
    "timestamp": "2026-06-10T12:00:00.000Z",
    "path": "/users",
    "method": "GET"
  }
}
```

### Error

```json
{
  "success": false,
  "message": "Human-safe error message",
  "code": "ERROR_CODE",
  "statusCode": 400,
  "errors": [],
  "meta": {
    "requestId": "a1b2c3d4e5f6...",
    "timestamp": "2026-06-10T12:00:00.000Z",
    "path": "/auth/login",
    "method": "POST"
  }
}
```

---

## Authentication

All protected endpoints use **Bearer token** authentication. The global `DocumentBuilder` applies bearer auth to all operations automatically.

```
Authorization: Bearer <accessToken>
```

---

## Standard Decorators

### Response Decorators

| Decorator | HTTP Status | Use |
|-----------|-------------|-----|
| `ApiStandardOkResponse` | 200 | Single-resource GET, PUT, PATCH |
| `ApiStandardCreatedResponse` | 201 | POST that creates a resource |
| `ApiStandardNoContentResponse` | 204 | DELETE or action with no body |
| `ApiStandardPaginatedResponse` | 200 | GET list endpoints returning `{ items, pagination }` |
| `ApiStandardMessageResponse` | 200/other | Actions returning only a message |
| `ApiCommonErrorResponses` | 4xx/5xx | Aggregates all standard error responses |

### Paginated List Response

For list endpoints, `data` is an object containing `items` and `pagination`:

```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  },
  "meta": { ... }
}
```

---

## File Structure

```
src/common/swagger/
  api-tags.ts                          — API_TAG_USERS, API_TAG_ROLES, etc.
  api-error-response.decorators.ts     — ApiCommonErrorResponses, error decorators
  api-standard-response.decorators.ts  — ApiStandardOkResponse, Paginated, etc.
  swagger.config.ts                     — setupSwagger() with DocumentBuilder
  swagger.module.ts                     — SwaggerModule integration

src/modules/{module}/swagger/
  auth.swagger.ts        — ApiLoginDocs, ApiRegisterDocs, etc.
  users.swagger.ts       — ApiListUsersDocs, ApiGetUserDocs, etc.
  roles.swagger.ts       — ApiListRolesDocs, ApiGetRoleDocs, etc.
  audit-logs.swagger.ts — ApiListAuditLogsDocs, ApiGetAuditLogDocs, etc.
  api-request-logs.swagger.ts — ApiListApiRequestLogsDocs, etc.
  permissions.swagger.ts — ApiListPermissionsDocs, etc.
```

---

## Key Implementation Notes

### Environment-Aware Setup

`swagger.config.ts` reads `process.env.SWAGGER_ENABLED`. If not `'true'`, `setupSwagger()` is a no-op — no Swagger document is built or mounted.

### Global Bearer Auth

`DocumentBuilder` calls `addBearerAuth()` once at setup time, so all operations inherit bearer auth without per-endpoint configuration.

### Non-Enumerable Marker

The `ApiResponseInterceptor` uses a non-enumerable `Symbol.for('devspherex.apiResponseWrapped')` internally. This marker never appears in JSON output sent to clients.

### Compact Decorators

Each module exports compact `@ApiXxxDocs()` decorators (e.g. `@ApiListUsersDocs()`) that bundle tags, operation, response decorators, and error responses into a single reusable decorator.

### Error Response Codes

All error responses include a stable `code` string:

| Code | Status | Description |
|------|--------|-------------|
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected error |
| `BAD_REQUEST` | 400 | Malformed request |
| `VALIDATION_FAILED` | 400 | DTO validation failed |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Token valid but no permission |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Unique constraint violation |
| `RATE_LIMITED` | 429 | Too many requests |
| `AUTH_INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `AUTH_TOKEN_EXPIRED` | 401 | Access token expired |
| `RBAC_ACCESS_DENIED` | 403 | Missing required permission |
| `DB_RECORD_NOT_FOUND` | 404 | Prisma P2025 |
| `DB_UNIQUE_CONSTRAINT` | 409 | Prisma P2002 |
