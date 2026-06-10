# Phase 6-R1 — Response Contract Hardening & Validation Error Wiring
## QA Report

---

## 1. What Was Wrong After Phase 6

Phase 6 delivered the foundation, but two critical blockers remained:

**Blocker 1 — Internal Marker Leakage:**
`ApiResponseInterceptor` set `__api_response_wrapped__` as an **enumerable string property** on the response object. This marker could appear in the JSON response sent to API clients, breaking the public contract and leaking implementation details.

**Blocker 2 — ValidationPipe Not Wired to Formatter:**
`validation-error.formatter.ts` existed and worked for the formatter unit, but `main.ts` did not configure `ValidationPipe` with a custom `exceptionFactory`. NestJS default ValidationPipe returns `message: string[]` without a structured `errors` array. This meant real DTO validation errors would produce `code: BAD_REQUEST` with empty `errors[]`, not the expected `code: VALIDATION_FAILED` with field-level errors.

---

## 2. Marker Leakage Fix

### Problem
`api-response.types.ts` used:
```typescript
export const WRAPPED_MARKER = '__api_response_wrapped__' as const;
export function isWrapped(value: unknown): boolean {
  return typeof value === 'object' && value !== null && WRAPPED_MARKER in value;
}
```
And the interceptor set it as a plain property:
```typescript
(response as Record<string, unknown>)[WRAPPED_MARKER] = true;
```
This made it enumerable — `Object.keys(response)` and `JSON.stringify(response)` would include it.

### Solution
Replaced with a non-enumerable `Symbol.for()`:

```typescript
const WRAPPED_SYMBOL = Symbol.for('devspherex.apiResponseWrapped');

export function markWrapped(obj: object): void {
  Object.defineProperty(obj, WRAPPED_SYMBOL, {
    value: true,
    enumerable: false,
    configurable: false,
  });
}

export function isWrapped(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  return Reflect.has(value, WRAPPED_SYMBOL);
}
```

### Result
- `JSON.stringify(response)` never includes the marker
- `Object.keys(response)` never includes the marker
- Double-wrapping prevention still works via Symbol-based detection

---

## 3. ValidationPipe exceptionFactory Wiring

### Problem
Default NestJS ValidationPipe returns a response like:
```json
{
  "statusCode": 400,
  "message": ["email must be an email", "password must be longer"],
  "error": "Bad Request"
}
```
Not the structured `{ message, errors[] }` that `GlobalExceptionFilter` expected.

### Solution — main.ts
```typescript
import { ValidationPipe, BadRequestException, ValidationError } from '@nestjs/common';

// ...

app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    validationError: { target: false, value: false },
    exceptionFactory: (errors: ValidationError[]) =>
      new BadRequestException({
        message: 'Validation failed',
        errors,
      }),
  }),
);
```

### Result
Validation errors now produce:
```json
{
  "success": false,
  "message": "Validation failed",
  "code": "VALIDATION_FAILED",
  "statusCode": 400,
  "errors": [
    { "field": "email", "message": "email must be an email", "code": "VALIDATION_FIELD_INVALID" }
  ],
  "meta": { ... }
}
```

---

## 4. Validation Formatter Improvements

### Dot-Path Flattening
`validation-error.formatter.ts` now builds dot-paths for nested errors:
```typescript
// address.street instead of just "street"
function walk(item: ValidationErrorItem, parentPath?: string): void {
  const fieldPath = parentPath ? `${parentPath}.${item.property}` : item.property;
  // ...
}
```

### Nested Sensitive Field Sanitization
Sensitive detection now works on dot-paths:
```typescript
function isSensitivePath(path: string): boolean {
  return path.split('.').some((segment) =>
    SENSITIVE_FIELDS.has(segment.toLowerCase())
  );
}
// credentials.password → field
// auth.refreshToken → field
```

### Required vs Invalid Distinction
```typescript
const code =
  message.toLowerCase().includes('not empty') || message.toLowerCase().includes('required')
    ? AppErrorCodes.VALIDATION_FIELD_REQUIRED
    : AppErrorCodes.VALIDATION_FIELD_INVALID;
```

### Expanded Sensitive Fields
Full set now includes: `password`, `passwordconfirm`, `currentpassword`, `newpassword`, `oldpassword`, `otp`, `resettoken`, `refreshtoken`, `accesstoken`, `token`, `passwordhash`, `tokenhash`, `resettokenhash`, `otphash`, `secret`, `pepper`, `devotp`, `resetcode`

---

## 5. Message-Envelope Detection Hardening

### Problem
Old logic used `Object.keys(data).length <= 3` which could incorrectly treat domain objects as auth envelopes.

### Solution — `isControllerMessageEnvelope()`
```typescript
const KNOWN_ENVELOPE_KEYS = new Set([
  'message', 'data', 'accessToken', 'refreshToken', 'user',
  'devOtp', 'resetSessionToken', 'expiresIn', 'token',
]);

function isControllerMessageEnvelope(value: unknown): boolean {
  // Must have string message
  if (!('message' in obj) || typeof obj['message'] !== 'string') return false;

  const nonMessageKeys = Object.keys(obj).filter((k) => k !== 'message');
  if (nonMessageKeys.length === 0) return true; // { message } only

  // All remaining keys must be known envelope keys
  return nonMessageKeys.every((k) => KNOWN_ENVELOPE_KEYS.has(k));
}
```

### Result
| Input | Behavior |
|-------|----------|
| `{ message: 'Logged out' }` | → envelope, `data: null` |
| `{ message, accessToken, refreshToken }` | → envelope, `data: { tokens }` |
| `{ message, id, email, body }` | → NOT envelope, `data` contains all fields |

---

## 6. HTTP-Level Validation Tests

Added `src/common/errors/validation-error.integration.spec.ts` with supertest + a minimal NestJS app. Tests cover:

| Test | What it verifies |
|------|-----------------|
| `POST /test-validation` invalid DTO | `code: VALIDATION_FAILED`, `errors[]` populated |
| `POST /test-validation` with extraField | `forbidNonWhitelisted` produces error |
| Sensitive field sanitization | `password` never appears in JSON |
| `x-request-id` propagation | Header reused, `meta.requestId` matches |
| Valid DTO | `success: true`, no marker in JSON |
| `POST /test-throw-error` | Production: safe message, no secrets, no stack |
| `POST /test-throw-string` | String thrown → 500 safe response |
| Nested dot-paths | `profile.firstName` in errors |

---

## 7. Unexpected Error Tests

| Scenario | Expected Behavior |
|----------|-----------------|
| `throw new Error('boom password: secret')` in production | 500, safe message, no secrets |
| `throw 'string value'` | 500, safe message |
| `NODE_ENV = 'production'` | Generic error message to client |
| `NODE_ENV = 'development'` | Raw error message to client (debug) |

---

## 8. Prisma Error Mapping Verification

| Scenario | Expected |
|----------|----------|
| P2002 with `meta.target: ['email']` | `errors[0].field: 'email'` |
| P2025 not found | 404, `DB_RECORD_NOT_FOUND` |
| P2003 foreign key | 409, `DB_FOREIGN_KEY_CONSTRAINT` |
| PrismaClientInitializationError | 503, `DB_CONNECTION_ERROR` |
| No raw Prisma message in response | ✅ |

---

## 9. RequestId Verification

| Test | Expected |
|------|----------|
| No `x-request-id` header sent | New 32-char hex ID generated |
| Valid `x-request-id` header sent | Reused verbatim |
| Invalid `x-request-id` (too long, special chars) | New ID generated |
| `x-request-id` in response header | Matches `meta.requestId` |
| `meta.requestId` in error response | Present and valid |

---

## 10. Commands Executed and Results

```
npm run build        ✅ PASS
npm run lint         ✅ PASS
npx prisma validate  ✅ PASS
npx ts-node scripts/validate-permissions.ts  ✅ PASS
npm run test         ✅ 18 suites, all PASS
npm run test:cov     ✅ Coverage above threshold
npm run test:smoke   ✅ Boot detected ✓
npm run quality:check ✅ All gates green
```

---

## 11. Test & Coverage Results

| Suite | Tests | Status |
|-------|-------|--------|
| `api-response.interceptor.spec.ts` | 14 (added marker + strict envelope) | ✅ |
| `app-exception.filter.spec.ts` | 16 (added exceptionFactory tests) | ✅ |
| `validation-error.formatter.spec.ts` | 8 (added dot-path + REQUIRED code) | ✅ |
| `validation-error.integration.spec.ts` | 11 (HTTP-level) | ✅ |
| `request-id.util.spec.ts` | 6 | ✅ |
| All existing security tests | — | ✅ |

---

## 12. Smoke Result

```
[smoke] Boot detected ✓
```

---

## 13. Remaining Limitations

- No end-to-end test with real DB (integration tests use minimal app without DB)
- HTTP-level integration tests run in-process without real network
- No performance/load testing of response interceptor
- No test for very large nested validation depth (>5 levels)

---

## 14. Recommended Next Phase

**Phase 7 — Request/Response Logging & Audit Trail**

- Structured request/response logging (JSON format)
- Sensitive data redaction in logs
- Audit trail for auth events (login, logout, password change)
- Log correlation via requestId
- Log levels: error, warn, info, debug
- File/transport-agnostic (structured JSON to stdout)

**Phase 6 remains the stable foundation — R1 fixes were surgical and backward-compatible.**