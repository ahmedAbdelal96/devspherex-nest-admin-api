# Phase 7-B Request Observability QA Report

**Date:** 2026-06-11
**Phase:** 7-B
**Status:** ✅ Complete

---

## Summary

Phase 7-B adds request observability infrastructure that logs every API request after completion. All acceptance criteria met, all validations passing.

---

## What Was Built

### Schema Changes (`prisma/schema.prisma`)

- `ApiRequestLog` model added with: `requestId`, `method`, `path`, `route`, `statusCode`, `durationMs`, `outcome`, `ipAddress`, `userAgent`, `errorCode`, `errorMessage`, `actorId`, `userEmail`, `userRoleId`
- `outcome` field: `SUCCESS` (default) for status < 400, `FAILURE` for status >= 400
- `route` field stores route pattern (e.g. `/users/:id`) for path parameter correlation
- All indexes for query performance: `requestId`, `actorId`, `method`, `path`, `route`, `statusCode`, `outcome`, `userEmail`, `errorCode`, `durationMs`, `createdAt`, composite indexes

### `ApiRequestObservabilityInterceptor`

- Globally registered via `APP_INTERCEPTOR` token
- Logs every request after completion (success or failure)
- Skips `/health`, `/favicon`, `/static` paths
- Captures: `requestId`, `method`, `path`, `route`, `statusCode`, `durationMs`, `outcome`, `user` (id/email/roleId), `ipAddress`, `userAgent`, `errorCode`, `errorMessage`
- Non-blocking: uses `tap` + `catchError` operators, logging failures never propagate

### `ApiRequestLogService`

- Non-blocking: wraps repository calls in try/catch, logs warning on failure, never throws
- Truncates `path` to 2048 chars and `userAgent` to 512 chars

### `ApiRequestLogsRepository`

- `create()`: inserts log record with all fields
- `findAll()`: supports filtering by `requestId`, `method`, `path` (contains), `route` (contains), `statusCode`, `outcome`, `userId` (→ actorId), `errorCode`, date range (`from`/`to`), `minDurationMs`/`maxDurationMs`, pagination (page/limit, cap at 100)
- `findById()`: single record lookup

### `ApiRequestLogsController`

- `GET /api-request-logs` — list with query params (filtering, pagination)
- `GET /api-request-logs/:id` — get single
- Protected by `api-request-logs.read` permission

### `GlobalExceptionFilter` Enhancement

- `buildErrorResponse()` sets `req.observability = { errorCode, errorMessage }` before returning
- This allows the interceptor to capture error codes for HttpException errors

### Error Code Derivation

For generic errors (no `getStatus`), the interceptor uses `statusToErrorCode()` to derive error code from HTTP status:
- 400 → `BAD_REQUEST`, 401 → `AUTH_UNAUTHORIZED`, 403 → `AUTH_FORBIDDEN`, 404 → `NOT_FOUND`, 409 → `CONFLICT`, 429 → `RATE_LIMITED`, 503 → `SERVICE_UNAVAILABLE`, default → `INTERNAL_SERVER_ERROR`

---

## Test Coverage

| Test File | What It Tests |
|---|---|
| `api-request-observability.interceptor.spec.ts` | Unit tests for interceptor: success/failure logging, skip paths, user extraction, IP extraction, errorCode from observability, non-blocking behavior |
| `api-request-observability.integration.spec.ts` | Integration tests: real HTTP requests via supertest, verifies Phase 6 response contract preserved, errorCode captured, skip paths work |
| `app-exception.filter.spec.ts` | Unit tests for observability attachment in filter: BadRequest, Unauthorized, NotFound, generic Error, unknown thrown, sanitization |
| `api-request-log.service.spec.ts` | Unit tests for non-blocking service behavior |
| `api-request-logs.repository.spec.ts` | Unit tests for repository create/findAll/findById |

---

## Validation Results

| Check | Result |
|---|---|
| `npm run build` | ✅ Pass |
| `npm run lint` | ✅ Pass (0 errors, 0 warnings) |
| `npx prisma format` | ✅ Pass |
| `npx prisma validate` | ✅ Pass |
| `npx prisma generate` | ✅ Pass |
| `npm run test` | ✅ 377 tests pass |
| `npm run test:cov` | ✅ Pass (coverage report generated) |
| `npm run test:smoke` | ✅ Pass (boot detected) |
| `npm run quality:check` | ✅ Pass |
| `npx ts-node scripts/validate-permissions.ts` | ✅ Pass (`api-request-logs.read` present) |

---

## Design Decisions

### Why `statusToErrorCode()` for generic errors

The `catchError` operator in the interceptor fires **before** the `GlobalExceptionFilter` runs for generic errors. The filter sets `req.observability` synchronously before sending the response, but `catchError` is already in the RxJS error path before the filter's response.json() call completes. Therefore, for generic errors (which have no `getStatus()`), the interceptor derives the error code from the HTTP status — which is always accurate since the filter maps status → code deterministically.

### Why `requestId` is optional in schema

The interceptor logs requests that may not have generated a request ID yet (though in practice `requestIdMiddleware` always sets one before any handler runs). Making it optional avoids null constraint violations in edge cases.

### Why `outcome` field

Storing `SUCCESS`/`FAILURE` as a dedicated field allows efficient filtering without querying by status code ranges. The outcome is derived from status code (< 400 = SUCCESS, >= 400 = FAILURE).

---

## Constraints Respected

✅ Request/response bodies not logged
✅ Authorization headers not logged
✅ Cookies not logged
✅ Phase 6 response/error contract not modified
✅ No Swagger/external monitoring/Sentry implemented
✅ No git reset/clean/checkout/pull/rebase

---

## Files Created/Modified

**Created:**
- `src/modules/api-request-logs/constants/api-request-log.constants.ts`
- `src/modules/api-request-logs/dto/list-api-request-logs-query.dto.ts`
- `src/modules/api-request-logs/dto/api-request-log-response.dto.ts`
- `src/modules/api-request-logs/mappers/api-request-log-response.mapper.ts`
- `src/modules/api-request-logs/repositories/api-request-logs.repository.ts`
- `src/modules/api-request-logs/repositories/api-request-logs.repository.spec.ts`
- `src/modules/api-request-logs/services/api-request-log.service.ts`
- `src/modules/api-request-logs/services/api-request-log.service.spec.ts`
- `src/modules/api-request-logs/interceptors/api-request-observability.interceptor.ts`
- `src/modules/api-request-logs/interceptors/api-request-observability.interceptor.spec.ts`
- `src/modules/api-request-logs/interceptors/api-request-observability.integration.spec.ts`
- `src/modules/api-request-logs/use-cases/list-api-request-logs.use-case.ts`
- `src/modules/api-request-logs/use-cases/list-api-request-logs.use-case.spec.ts`
- `src/modules/api-request-logs/use-cases/get-audit-log.use-case.ts`
- `src/modules/api-request-logs/api-request-logs.controller.ts`
- `src/modules/api-request-logs/api-request-logs.module.ts`
- `docs/observability/request-observability-contract.md`
- `docs/qa/phase-7b-request-observability-qa-report.md`

**Modified:**
- `prisma/schema.prisma` — added `ApiRequestLog` model
- `src/common/errors/app-exception.filter.ts` — added `req.observability` attachment
- `src/common/errors/app-exception.filter.spec.ts` — added observability attachment tests
- `src/app.module.ts` — added `ApiRequestLogsModule` import
- `src/test-utils/mocks.ts` — added `apiRequestLog` mock
- `docs/testing/testing-strategy.md` — updated Phase, added api-request-logs test files

---

## Next Steps

None — Phase 7-B is complete and all acceptance criteria are met.