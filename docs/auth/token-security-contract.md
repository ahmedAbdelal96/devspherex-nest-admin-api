# Token Security Contract

## Phase 3 - Auth Token Security & Token Versioning

---

## 1. Access Token Payload

Access tokens are JWTs with the following payload:

```typescript
{
  sub: string;        // user.id
  email: string;       // user.email
  roleId: string | null;  // user.roleId
  tokenVersion: number; // user.tokenVersion
}
```

### Validation Rules

When validating an access token via `JwtStrategy`:

1. **Token version must be present** - reject if missing
2. **User must exist** - reject if user not found
3. **User must be ACTIVE** - reject if status !== 'ACTIVE'
4. **Token version must match** - reject if `payload.tokenVersion !== user.tokenVersion`

If any check fails, throw `UnauthorizedException`.

---

## 2. Refresh Token Format

### Format: `${jti}.${secret}`

- **jti**: UUID v4 - unique token identifier for database lookup
- **secret**: 64 random hex characters - makes token unguessable

### Example
```
a1b2c3d4-e5f6-7890-abcd-ef1234567890.abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
```

---

## 3. Refresh Token DB Storage

Only the hash is stored in the database:

| Field | Description |
|-------|-------------|
| `id` | Primary key (UUID) |
| `userId` | Foreign key to User |
| `tokenHash` | bcrypt hash of full raw token |
| `jti` | Unique token identifier (UUID) - used for lookup |
| `familyId` | Token family for rotation tracking |
| `expiresAt` | Expiration timestamp |
| `revokedAt` | Revocation timestamp (null if active) |
| `replacedByTokenId` | ID of replacement token |

**Security rules:**
- Never store raw refresh token in database
- Never return tokenHash to client
- Never log tokens

---

## 4. Refresh Token Service Methods

```typescript
interface RefreshTokenService {
  // Generate a new refresh token payload (async)
  generateRefreshTokenPayloadAsync(): Promise<{
    rawToken: string;      // Sent to client
    jti: string;
    familyId: string;
    tokenHash: string;     // Stored in DB
    expiresAt: Date;
  }>;

  // Extract jti from raw token
  extractJti(rawToken: string): string | null;

  // Verify raw token against stored hash (async)
  verifyRefreshTokenAsync(rawToken: string, tokenHash: string): Promise<boolean>;

  // Get expiry date for refresh tokens
  getRefreshTokenExpiry(): Date;
}
```

---

## 5. Refresh Token Flow

### Login/Register
1. Generate refresh token payload
2. Store `tokenHash` in database with `jti`, `familyId`
3. Return `rawToken` to client

### Refresh
1. Client sends `rawToken`
2. Extract `jti` from token
3. Find token by `jti` in database
4. Verify token not revoked (`revokedAt === null`)
5. Verify token not expired (`expiresAt > now`)
6. Verify `rawToken` against `tokenHash`
7. Load user and check status
8. Generate new access token with current `tokenVersion`

### Logout (single device)
1. Client sends `rawToken`
2. Extract `jti` and verify ownership
3. Revoke token by `jti`
4. Increment `user.tokenVersion`

### Logout All
1. Revoke all tokens for user
2. Increment `user.tokenVersion`

---

## 6. Logout Behavior

**Endpoint:** `POST /api/v1/auth/logout`

**Requires:** Authenticated user (JWT)

**Request body:**
```json
{
  "refreshToken": "jti.secret"
}
```

**Behavior:**
1. Extract `jti` from refresh token
2. Find token by `jti`
3. Reject if token not found
4. Verify token ownership (jti belongs to user)
5. Reject if token already revoked (`revokedAt !== null`)
6. Reject if token expired (`expiresAt < now`)
7. Verify token hash matches
8. Revoke refresh token in DB
9. Increment `user.tokenVersion` to invalidate access tokens

**Response:** `{ "message": "Logged out successfully" }`

---

## 7. Logout All Behavior

**Endpoint:** `POST /api/v1/auth/logout-all`

**Requires:** Authenticated user (JWT)

**Behavior:**
1. Revoke all refresh tokens for user
2. Increment `user.tokenVersion`

**Note:** This endpoint doesn't require a refresh token in the body since it revokes all tokens.

---

## 8. Change Password Invalidation

**Endpoint:** `POST /api/v1/auth/change-password`

**Requires:** Authenticated user (JWT)

**Request body:**
```json
{
  "currentPassword": "string",
  "newPassword": "string"
}
```

**Behavior:**
1. Verify current password
2. Update `passwordHash`
3. Revoke all refresh tokens
4. Increment `user.tokenVersion`

---

## 9. Disabled User Token Invalidation

When a user's status changes from `ACTIVE` to `DISABLED`:

1. Revoke all refresh tokens for user
2. Increment `user.tokenVersion`

This ensures:
- All access tokens become invalid
- All refresh tokens become invalid
- User cannot use any existing tokens

**Note:** Re-enabling a user does NOT decrement `tokenVersion`.

---

## 10. What Is NOT Implemented Yet

### Full Refresh Token Family Reuse Detection
- Not implemented: detecting when a refresh token is used after being rotated
- Not implemented: chain validation of `replacedByTokenId`
- This will be implemented in a later phase

### RBAC Permission Guards
- `@Public()`, `@Permissions()` decorators not implemented
- `PermissionsGuard` not implemented
- This will be implemented in Phase 4

### Audit Behavior
- Audit logs not created in auth use-cases
- This will be implemented in Phase 8

---

## 11. Security Summary

| Action | Invalidates Access Tokens | Revokes Refresh Tokens |
|--------|---------------------------|----------------------|
| Logout | Yes (via tokenVersion++) | Yes (one token) |
| Logout All | Yes (via tokenVersion++) | Yes (all tokens) |
| Change Password | Yes (via tokenVersion++) | Yes (all tokens) |
| Disable User | Yes (via tokenVersion++) | Yes (all tokens) |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.1.0 | 2026-06-09 | R1: Added logout-all, tightened logout validation |
| 1.0.0 | 2026-06-09 | Initial Phase 3 implementation |

---

## Sign-Off

| Checkpoint | Status |
|------------|--------|
| Access token includes tokenVersion | ✅ |
| JwtStrategy validates tokenVersion | ✅ |
| JwtStrategy rejects disabled users | ✅ |
| Refresh token format: jti.secret | ✅ |
| Only hash stored in DB | ✅ |
| Raw token returned to client | ✅ |
| Logout invalidates tokens | ✅ |
| Logout rejects revoked/expired tokens | ✅ |
| Logout-all invalidates tokens | ✅ |
| Change-password invalidates tokens | ✅ |
| Disable user invalidates tokens | ✅ |
| Async hash/verify methods | ✅ |