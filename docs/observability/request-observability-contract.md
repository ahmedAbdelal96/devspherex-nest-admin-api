# Request Observability Contract

**Date:** 2026-06-11
**Phase:** 7-B

---

## Overview

Request observability logs every API request after completion for security review, incident investigation, and operational monitoring. It is **non-blocking**: logging failures must never break API requests.

---

## ApiRequestLog Entity

The `ApiRequestLog` Prisma model stores all request log records:

```prisma
model ApiRequestLog {
  id           String   @id @default(uuid())
  requestId    String?  @unique @map("request_id")
  actorId      String?  @map("actor_id")
  userEmail    String?  @map("user_email")
  userRoleId   String?  @map("user_role_id")
  method       String   @map("method")
  path         String   @map("path")
  route        String?  @map("route")
  statusCode   Int      @map("status_code")
  durationMs   Int      @map("duration_ms")
  outcome      String   @default("SUCCESS") @map("outcome")
  ipAddress    String?  @map("ip_address")
  userAgent    String?  @map("user_agent")
  errorCode    String?  @map("error_code")
  errorMessage String?  @map("error_message")
  createdAt    DateTime @default(now()) @map("created_at")
}
```

| Field | Description |
|---|---|
| `requestId` | Phase 6 request tracking ID (correlation) |
| `actorId` | ID of authenticated user (null for unauthenticated) |
| `userEmail` | Email of authenticated user when available |
| `userRoleId` | Role ID of authenticated user when available |
| `method` | HTTP method (GET, POST, PUT, DELETE, etc.) |
| `path` | Full request path |
| `route` | Route pattern (e.g. `/users/:id`) for path parameter correlation |
| `statusCode` | HTTP response status code |
| `durationMs` | Request processing time in milliseconds |
| `outcome` | `SUCCESS` (status < 400) or `FAILURE` (status >= 400) |
| `ipAddress` | Client IP (supports x-forwarded-for) |
| `userAgent` | User-Agent header |
| `errorCode` | Error code from exception (e.g. `INTERNAL_SERVER_ERROR`) |
| `errorMessage` | Sanitized error message (no sensitive data) |
| `createdAt` | Timestamp of log creation |

---

## Global Interceptor Registration

The `ApiRequestObservabilityInterceptor` is registered globally via `APP_INTERCEPTOR` token in `ApiRequestLogsModule`:

```typescript
{
  provide: APP_INTERCEPTOR,
  useClass: ApiRequestObservabilityInterceptor,
}
```

This ensures every request passes through the interceptor.

---

## Skipped Paths

The following paths are **not logged** to reduce noise:

- `/health` — health check endpoints
- `/favicon` — browser favicon requests
- `/static` — static asset requests

---

## Non-Blocking Logging

`ApiRequestLogService` wraps repository calls in try/catch — logging failures are caught and logged as warnings but never propagate. This ensures audit infrastructure issues don't affect API availability.

---

## Error Code Capture

Error codes are captured in two ways:

1. **HttpException errors** (e.g. `BadRequestException`, `NotFoundException`): The interceptor reads `req.observability.errorCode` which is set by `GlobalExceptionFilter` before the response is sent.

2. **Generic errors** (no `getStatus`): The interceptor derives error code from HTTP status using `statusToErrorCode()`:
   - 400 → `BAD_REQUEST`
   - 401 → `AUTH_UNAUTHORIZED`
   - 403 → `AUTH_FORBIDDEN`
   - 404 → `NOT_FOUND`
   - 409 → `CONFLICT`
   - 429 → `RATE_LIMITED`
   - 503 → `SERVICE_UNAVAILABLE`
   - default → `INTERNAL_SERVER_ERROR`

---

## What Is NOT Logged

Per design constraints:

- **Request bodies** — never logged
- **Response bodies** — never logged
- **Authorization headers** — never logged
- **Cookie values** — never logged
- **Query parameters** — never logged
- **Path parameters** — never logged

---

## Admin Read Endpoint

`GET /api-request-logs` — List request logs with filtering, pagination, sorting.

`GET /api-request-logs/:id` — Get single request log by ID.

Both require `api-request-logs.read` permission.

---

## Phase 6 Compatibility

Request observability does **not** modify the Phase 6 response/error contract. The `GlobalExceptionFilter` still produces the same `ApiErrorResponse` shape. Request observability only adds logging infrastructure around it.