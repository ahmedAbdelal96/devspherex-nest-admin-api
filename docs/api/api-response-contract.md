# API Response Contract

## Overview

All HTTP responses from this API are wrapped in a consistent envelope. Both success and error responses follow a strict shape that guarantees clients can always rely on a predictable structure.

---

## Success Response Shape

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

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Always `true` for successful responses |
| `message` | `string` | Human-readable description of the outcome |
| `data` | `object \| array \| null` | The actual payload returned by the controller |
| `meta` | `object` | Request metadata |

### Meta Fields

| Field | Type | Description |
|-------|------|-------------|
| `requestId` | `string` | UUID of the request (from `x-request-id` header or generated) |
| `timestamp` | `string` | ISO 8601 timestamp of when the response was generated |
| `path` | `string` | The route path (e.g. `/users`) |
| `method` | `string` | HTTP method (e.g. `GET`, `POST`) |

### Default Messages

| Method | Scenario | Default Message |
|--------|----------|-----------------|
| GET | List endpoint | `Records retrieved successfully` |
| GET | Single record | `Record retrieved successfully` |
| POST | Creation | `{Resource} created successfully` |
| PUT/PATCH | Update | `{Resource} updated successfully` |
| DELETE | Deletion | `{Resource} deleted successfully` |

Controllers that return `{ message: string }` (e.g. auth logout) preserve their message in the response.

---

## Error Response Shape

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

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Always `false` for errors |
| `message` | `string` | Safe for client display — never leaks internals |
| `code` | `string` | Stable machine-readable error code |
| `statusCode` | `number` | Matches the HTTP status code |
| `errors` | `ApiFieldError[]` | Field-level errors (validation, etc.) |
| `meta` | `object` | Same metadata as success responses |

### ApiFieldError

```json
{
  "field": "email",
  "message": "email must be an email",
  "code": "VALIDATION_FIELD_INVALID"
}
```

---

## Request ID Behavior

- Client MAY send `x-request-id: <value>` header
- If the value is valid (alphanumeric, ≤64 chars), it is reused
- If missing, invalid, or empty, a new 32-char hex ID is generated
- The `requestId` is included in both success and error `meta`
- The `x-request-id` header is always set on the response

---

## Validation Error Format

When `ValidationPipe` rejects a request:

```json
{
  "success": false,
  "message": "Validation failed",
  "code": "VALIDATION_FAILED",
  "statusCode": 400,
  "errors": [
    { "field": "email", "message": "email must be an email", "code": "VALIDATION_FIELD_INVALID" },
    { "field": "password", "message": "password must be longer", "code": "VALIDATION_FIELD_INVALID" }
  ],
  "meta": { ... }
}
```

- Sensitive field names (`password`, `otp`, `token`, etc.) are replaced with `"field"`
- Raw values are stripped from messages
- Nested validation errors are flattened

---

## Prisma Error Mapping

| Prisma Code | HTTP Status | Error Code | Client Message |
|-------------|-------------|------------|---------------|
| P2002 |409 | DB_UNIQUE_CONSTRAINT | A record with this value already exists |
| P2025 | 404 | DB_RECORD_NOT_FOUND | The requested record was not found |
| P2003 | 409 | DB_FOREIGN_KEY_CONSTRAINT | Operation failed due to invalid relation |
| P2001 | 400 | DB_INVALID_QUERY | A required field is missing |
| P2006 | 400 | DB_INVALID_QUERY | A field value exceeds the allowed length |
| P2007 | 400 | DB_INVALID_QUERY | Data type mismatch |
| P1001/P1002/P1003/P1010/P1011 | 503 | DB_CONNECTION_ERROR | Database connection could not be established |
| (unknown) | 400 | DB_INVALID_QUERY | Database operation could not be completed |

---

## Unknown / Unexpected Error Handling

All unexpected errors (non-Error thrown values, runtime exceptions) return:

```json
{
  "success": false,
  "message": "An unexpected error occurred. Please try again later.",
  "code": "INTERNAL_SERVER_ERROR",
  "statusCode": 500,
  "errors": [],
  "meta": { ... }
}
```

**Production safety rules:**
- No stack traces in responses
- No raw Prisma messages or SQL details
- No password hashes, OTPs, tokens, or pepper values
- Error messages are sanitized (email addresses, secrets, tokens redacted)
- In development mode, generic Error messages are included for debugging

---

## Error Code Registry

### General
- `INTERNAL_SERVER_ERROR` — 500
- `BAD_REQUEST` — 400
- `VALIDATION_FAILED` — 400
- `VALIDATION_FIELD_INVALID` — 400
- `VALIDATION_FIELD_REQUIRED` — 400
- `UNAUTHORIZED` — 401
- `FORBIDDEN` — 403
- `NOT_FOUND` — 404
- `CONFLICT` — 409
- `RATE_LIMITED` — 429
- `SERVICE_UNAVAILABLE` — 503

### Auth
- `AUTH_INVALID_CREDENTIALS` — 401
- `AUTH_UNAUTHORIZED` — 401
- `AUTH_FORBIDDEN` — 403
- `AUTH_TOKEN_EXPIRED` — 401
- `AUTH_TOKEN_INVALID` — 401
- `AUTH_STALE_TOKEN` — 401
- `AUTH_REFRESH_TOKEN_INVALID` — 401
- `AUTH_REFRESH_TOKEN_REVOKED` — 401
- `AUTH_PASSWORD_RECOVERY_DISABLED` — 400
- `AUTH_PASSWORD_RECOVERY_INVALID_OR_EXPIRED` — 401

### RBAC
- `RBAC_ACCESS_DENIED` — 403
- `RBAC_ROUTE_UNCLASSIFIED` — 403
- `RBAC_MISSING_PERMISSION` — 403

### Database
- `DB_UNIQUE_CONSTRAINT` — 409
- `DB_RECORD_NOT_FOUND` — 404
- `DB_FOREIGN_KEY_CONSTRAINT` — 409
- `DB_INVALID_QUERY` — 400
- `DB_CONNECTION_ERROR` — 503
- `DB_TRANSACTION_ERROR` — 500

---

## File Structure

```
src/common/
  api-response/
    api-response.types.ts       — ApiSuccessResponse, isWrapped()
    api-response.factory.ts      — buildSuccessResponse(), deriveMessage()
    api-response.interceptor.ts  — ApiResponseInterceptor (global)
    api-response.index.ts
 errors/
    app-error-codes.ts          — AppErrorCodes registry
    error-response.types.ts     — ApiErrorResponse, ApiFieldError
    app-exception.filter.ts      — GlobalExceptionFilter (global)
    prisma-error.mapper.ts       — mapPrismaError(), extractPrismaField()
    validation-error.formatter.ts — formatValidationErrors()
    unknown-error.formatter.ts   — buildUnknownErrorResponse()
    index.ts
  request-context/
    request-id.util.ts           — generateRequestId(), getOrCreateRequestId()
    request-id.middleware.ts     — RequestIdMiddleware (global)
    index.ts
```
