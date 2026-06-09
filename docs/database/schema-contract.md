# Database Schema Contract

## Phase 1B - Core Database Structure

This document describes the final core database schema contract for the NestJS Admin API project.

---

## Enums

### UserStatus
| Value | Description |
|-------|-------------|
| `ACTIVE` | User account is active |
| `DISABLED` | User account is disabled |
| `PENDING` | User account is pending activation |

### RoleStatus
| Value | Description |
|-------|-------------|
| `ACTIVE` | Role is active and assignable |
| `DISABLED` | Role is disabled |

### PermissionOverrideEffect
| Value | Description |
|-------|-------------|
| `ALLOW` | Grants permission explicitly |
| `DENY` | Denies permission explicitly |

---

## Models

### User
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID, @default(uuid()) | Unique identifier |
| `name` | String | Required | User's full name |
| `email` | String | @unique | User's email address |
| `passwordHash` | String | Required | Bcrypt hashed password |
| `avatarUrl` | String? | Optional | URL to user's avatar |
| `phone` | String? | Optional | User's phone number |
| `status` | UserStatus | @default(ACTIVE) | Account status |
| `roleId` | String? | FK (Role), Optional | Assigned role |
| `tokenVersion` | Int | @default(1) | For JWT invalidation |
| `lastLoginAt` | DateTime? | Optional | Last login timestamp |
| `createdAt` | DateTime | @default(now()) | Creation timestamp |
| `updatedAt` | DateTime | @updatedAt | Last update timestamp |
| `deletedAt` | DateTime? | Optional | Soft delete timestamp |

**Indexes:**
- `@@index([email])`
- `@@index([status])`
- `@@index([roleId])`
- `@@index([deletedAt])`
- `@@index([createdAt])`
- `@@index([status, roleId, createdAt])`

**Relations:**
- `role`: Many-to-One with Role (optional)
- `permissionOverrides`: One-to-Many with UserPermissionOverride
- `refreshTokens`: One-to-Many with RefreshToken
- `auditLogs`: One-to-Many with AuditLog
- `apiRequestLogs`: One-to-Many with ApiRequestLog

---

### Role
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID, @default(uuid()) | Unique identifier |
| `name` | String | @unique | Role display name |
| `slug` | String | @unique | URL-safe identifier |
| `description` | String? | Optional | Role description |
| `status` | RoleStatus | @default(ACTIVE) | Role status |
| `isSystem` | Boolean | @default(false) | System role flag |
| `createdAt` | DateTime | @default(now()) | Creation timestamp |
| `updatedAt` | DateTime | @updatedAt | Last update timestamp |
| `deletedAt` | DateTime? | Optional | Soft delete timestamp |

**Indexes:**
- `@@index([slug])`
- `@@index([status])`
- `@@index([isSystem])`
- `@@index([deletedAt])`
- `@@index([createdAt])`

**Relations:**
- `permissions`: One-to-Many with RolePermission
- `users`: One-to-Many with User

---

### Permission
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID, @default(uuid()) | Unique identifier |
| `key` | String | @unique | Permission key (e.g., "users.read") |
| `resource` | String | Required | Resource name (e.g., "users") |
| `action` | String | Required | Action (e.g., "read", "create") |
| `label` | String | Required | Human-readable label |
| `description` | String? | Optional | Permission description |
| `group` | String | Required | Group name (e.g., "Users", "System") |
| `isSystem` | Boolean | @default(true) | System permission flag |
| `createdAt` | DateTime | @default(now()) | Creation timestamp |
| `updatedAt` | DateTime | @updatedAt | Last update timestamp |

**Indexes:**
- `@@index([key])`
- `@@index([resource])`
- `@@index([action])`
- `@@index([group])`
- `@@index([resource, action])`

**Relations:**
- `rolePermissions`: One-to-Many with RolePermission
- `userPermissionOverrides`: One-to-Many with UserPermissionOverride

---

### RolePermission
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID, @default(uuid()) | Unique identifier |
| `roleId` | String | FK (Role), Required | Role ID |
| `permissionId` | String | FK (Permission), Required | Permission ID |
| `createdAt` | DateTime | @default(now()) | Creation timestamp |

**Constraints:**
- `@@unique([roleId, permissionId])`

**Indexes:**
- `@@index([roleId])`
- `@@index([permissionId])`

**Relations:**
- `role`: Many-to-One with Role (onDelete: Cascade)
- `permission`: Many-to-One with Permission (onDelete: Cascade)

---

### UserPermissionOverride
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID, @default(uuid()) | Unique identifier |
| `userId` | String | FK (User), Required | User ID |
| `permissionId` | String | FK (Permission), Required | Permission ID |
| `effect` | PermissionOverrideEffect | Required | ALLOW or DENY |
| `createdAt` | DateTime | @default(now()) | Creation timestamp |

**Constraints:**
- `@@unique([userId, permissionId])`

**Indexes:**
- `@@index([userId])`
- `@@index([permissionId])`
- `@@index([effect])`

**Relations:**
- `user`: Many-to-One with User (onDelete: Cascade)
- `permission`: Many-to-One with Permission (onDelete: Cascade)

---

### RefreshToken
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID, @default(uuid()) | Unique identifier |
| `userId` | String | FK (User), Required | User ID |
| `tokenHash` | String | @unique | Hashed refresh token |
| `jti` | String | @unique | JWT ID for token tracking |
| `familyId` | String | Required | Token family for rotation |
| `expiresAt` | DateTime | Required | Expiration timestamp |
| `revokedAt` | DateTime? | Optional | Revocation timestamp |
| `replacedByTokenId` | String? | Optional | New token that replaced this |
| `createdAt` | DateTime | @default(now()) | Creation timestamp |

**Indexes:**
- `@@index([jti])`
- `@@index([userId])`
- `@@index([familyId])`
- `@@index([expiresAt])`
- `@@index([revokedAt])`
- `@@index([userId, revokedAt])`

**Relations:**
- `user`: Many-to-One with User (onDelete: Cascade)

---

### AuditLog
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID, @default(uuid()) | Unique identifier |
| `actorId` | String? | FK (User), Optional | User who performed action |
| `action` | String | Required | Action performed (e.g., "CREATE", "UPDATE") |
| `entity` | String? | Optional | Entity type affected |
| `entityId` | String? | Optional | ID of affected entity |
| `metadata` | Json? | Optional | Additional action metadata |
| `ip` | String? | Optional | IP address of request |
| `userAgent` | String? | Optional | User agent string |
| `requestId` | String? | Optional | Correlation request ID |
| `createdAt` | DateTime | @default(now()) | Creation timestamp |

**Note:** `entity` is optional to support system-level events that don't target a specific entity.

**Indexes:**
- `@@index([actorId])`
- `@@index([action])`
- `@@index([entity])`
- `@@index([entityId])`
- `@@index([createdAt])`
- `@@index([entity, entityId, createdAt])`
- `@@index([action, createdAt])`
- `@@index([actorId, createdAt])`

**Relations:**
- `actor`: Many-to-One with User (onDelete: SetNull)

---

### ApiRequestLog
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PK, UUID, @default(uuid()) | Unique identifier |
| `requestId` | String | @unique | Correlation request ID |
| `actorId` | String? | FK (User), Optional | Authenticated user |
| `method` | String | Required | HTTP method |
| `path` | String | Required | Request path |
| `statusCode` | Int | Required | HTTP status code |
| `durationMs` | Int | Required | Request duration in ms |
| `ip` | String? | Optional | Client IP address |
| `userAgent` | String? | Optional | Client user agent |
| `requestBody` | Json? | Optional | Request body |
| `query` | Json? | Optional | Query parameters |
| `params` | Json? | Optional | Route parameters |
| `responseError` | Json? | Optional | Response error details |
| `createdAt` | DateTime | @default(now()) | Creation timestamp |

**Indexes:**
- `@@index([requestId])`
- `@@index([actorId])`
- `@@index([path])`
- `@@index([statusCode])`
- `@@index([durationMs])`
- `@@index([createdAt])`
- `@@index([path, createdAt])`
- `@@index([statusCode, createdAt])`
- `@@index([actorId, createdAt])`

**Relations:**
- `actor`: Many-to-One with User (onDelete: SetNull)

---

## Normalization Rules

1. **User**: Single source of truth for user data. `name` field replaces `firstName`/`lastName`.
2. **Role**: Uses `slug` as unique identifier (not name). Name is for display only.
3. **Permission**: Uses `key` as unique identifier (not name). Resource/action/group structure.
4. **AuditLog**: Uses `actorId` instead of `userId`. Uses `entity` instead of `entityType`.
5. **RefreshToken**: Full rotation support via `jti`, `familyId`, `replacedByTokenId`.

---

## Future Phase Notes

### Phase 2 - Central Permissions Source of Truth
Permission management will be centralized with a dedicated permissions service that serves as the source of truth for all permission checks across the application.

### Phase 3 - Token Version Validation & Refresh Token Rotation
- `tokenVersion` runtime validation will be implemented to invalidate all sessions when needed
- Full refresh token rotation with reuse detection will be implemented using `jti` and `familyId`
- `replacedByTokenId` chain will be properly maintained

### Phase 4 - RBAC Effective Permissions
Effective permissions calculation will be implemented combining:
- Role permissions (via RolePermission join table)
- User permission overrides (via UserPermissionOverride)
- Permission effect resolution (ALLOW/DENY)

### Phase 7/8 - Request Logging & Tracking
ApiRequestLog will be populated via request logging interceptors for:
- Request/response tracking
- Performance monitoring
- Security auditing

### Phase 9 - Database Seeding
Seed script will populate initial:
- System roles (Admin, User, Viewer)
- System permissions (grouped by resource)
- Default admin user

---

## Schema Version
- **Version**: 1.0.0
- **Phase**: Phase 1B
- **Last Updated**: 2026-06-09