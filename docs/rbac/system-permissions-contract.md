# System Permissions Contract

## Phase 2 - Central Permissions Source of Truth

---

## 1. Why Permissions Must Have One Source of Truth

In a growing admin API system, permissions can easily become scattered across multiple files:

- Controllers define permission strings like `'users.read'`
- Guards hardcode permission checks
- Seed scripts create permissions without validation
- Tests use arbitrary permission strings
- Documentation references permissions inconsistently

This leads to:
- **Typos** that only appear at runtime
- **Duplicates** that cause confusion
- **Inconsistencies** between what's documented and what's enforced
- **Maintenance nightmares** when a permission key needs to change

### The Solution

All permissions are defined **once** in `src/common/rbac/system-permissions.ts`.

Every other part of the system imports from this single source:
- Controllers/decorators import `SYSTEM_PERMISSION_KEYS`
- Guards import and validate against `SYSTEM_PERMISSION_KEY_SET`
- Seed scripts import `SYSTEM_PERMISSIONS` for database seeding
- Tests import permissions for test data setup
- Documentation references the centralized list

---

## 2. Permission Naming Convention

### Format: `resource.action`

All permission keys follow dot notation: `resource.action`

- **Resource**: The entity being accessed (singular: `user`, not `users`)
- **Action**: What is being done (`read`, `create`, `update`, `delete`)

### Examples

| Key | Resource | Action | Description |
|-----|----------|--------|-------------|
| `users.read` | users | read | View user list |
| `users.create` | users | create | Create new user |
| `users.update` | users | update | Update user details |
| `users.delete` | users | delete | Delete user |
| `users.status.update` | users | status.update | Enable/disable user |
| `roles.permissions.update` | roles | permissions.update | Assign permissions to role |

### Rules

1. **Always lowercase**: `users.read` not `Users.Read`
2. **Singular resource**: `user` not `users` (except for meta-resources like `auditLogs`)
3. **Dot notation for compound actions**: `status.update`, `permissions.update`
4. **No trailing dots**: `users.read` not `users.read.`
5. **No leading dots**: `users.read` not `.users.read`

---

## 3. Permission Groups

Permissions are organized into logical groups:

| Group | Purpose |
|-------|---------|
| **Auth** | Account-related actions (view profile, change password) |
| **Users** | User management (CRUD, status, roles, permissions) |
| **Roles** | Role management (CRUD, permissions, duplication) |
| **Permissions** | Viewing available permissions |
| **Audit Logs** | System audit trail access |
| **API Request Logs** | HTTP request/response logging |
| **System** | Health checks and settings |

---

## 4. All Current System Permissions

### Auth Group

| Key | Label | Description |
|-----|-------|-------------|
| `auth.me.read` | View own account | Allows viewing the current user profile and account details |
| `auth.password.change` | Change password | Allows changing the current user password |

### Users Group

| Key | Label | Description |
|-----|-------|-------------|
| `users.read` | View users | Allows listing and viewing user accounts |
| `users.create` | Create users | Allows creating new user accounts |
| `users.update` | Update users | Allows updating user account details |
| `users.delete` | Delete users | Allows deleting user accounts |
| `users.status.update` | Update user status | Allows enabling or disabling user accounts |
| `users.role.update` | Update user role | Allows assigning or changing user roles |
| `users.permissions.read` | View user permissions | Allows viewing effective permissions for a user |
| `users.permissions.override` | Override user permissions | Allows adding direct permission overrides (allow/deny) for a user |

### Roles Group

| Key | Label | Description |
|-----|-------|-------------|
| `roles.read` | View roles | Allows listing and viewing roles |
| `roles.create` | Create roles | Allows creating new roles |
| `roles.update` | Update roles | Allows updating role details |
| `roles.delete` | Delete roles | Allows deleting roles |
| `roles.permissions.update` | Update role permissions | Allows assigning permissions to roles |
| `roles.duplicate` | Duplicate roles | Allows duplicating existing roles with their permissions |

### Permissions Group

| Key | Label | Description |
|-----|-------|-------------|
| `permissions.read` | View permissions | Allows listing and viewing all available permissions |
| `permissions.grouped.read` | View grouped permissions | Allows viewing permissions organized by group |

### Audit Logs Group

| Key | Label | Description |
|-----|-------|-------------|
| `auditLogs.read` | View audit logs | Allows viewing system audit logs |
| `auditLogs.create` | Create audit log entries | Allows creating audit log entries (used by system) |

### API Request Logs Group

| Key | Label | Description |
|-----|-------|-------------|
| `apiRequestLogs.read` | View API request logs | Allows viewing API request/response logs |

### System Group

| Key | Label | Description |
|-----|-------|-------------|
| `system.health.read` | View system health | Allows viewing system health status |
| `settings.read` | View settings | Allows viewing system settings |
| `settings.update` | Update settings | Allows modifying system settings |

---

## 5. How Future Seed Script Will Import from SYSTEM_PERMISSIONS

The seed script (Phase 9) will import permissions like this:

```typescript
import { SYSTEM_PERMISSIONS } from '../src/common/rbac/system-permissions';
import { PrismaService } from './prisma.service';

async function seedPermissions() {
  const prisma = new PrismaService();

  for (const permission of SYSTEM_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: {},
      create: {
        key: permission.key,
        resource: permission.resource,
        action: permission.action,
        label: permission.label,
        description: permission.description,
        group: permission.group,
        isSystem: permission.isSystem,
      },
    });
  }
}
```

**Benefits:**
- Seed always matches code-defined permissions
- No duplicate keys (enforced by validation)
- Adding a permission to `system-permissions.ts` automatically includes it in seed
- No manual synchronization needed

---

## 6. How Future Controllers/Decorators Will Import Keys

### In Decorators/Guards

```typescript
import { SYSTEM_PERMISSION_KEYS } from '@common/rbac';

// Later in a controller:
// @Permissions(SYSTEM_PERMISSION_KEYS.USERS_READ) // If using a flat structure
// Or if using namespace:
// @Permissions(SYSTEM_PERMISSION_KEYS.USERS.READ)
```

### Pattern for Namespaced Keys (Future Enhancement)

The current implementation exports a flat array. Future phases may add namespaced exports:

```typescript
// Future enhancement - namespaced export
export const PERMISSION_KEYS = {
  AUTH: {
    ME_READ: 'auth.me.read',
    PASSWORD_CHANGE: 'auth.password.change',
  },
  USERS: {
    READ: 'users.read',
    CREATE: 'users.create',
    // ...
  },
} as const;
```

---

## 7. Rules to Add a New Permission Safely

### Step 1: Add to the Correct Group in system-permissions.ts

```typescript
const USERS_PERMISSIONS: SystemPermissionDefinition[] = [
  // ... existing permissions
  {
    key: 'users.export',        // Must be unique, use dot notation
    resource: 'users',           // Match the group resource
    action: 'export',            // Action name
    label: 'Export users',        // Human-readable label
    description: 'Allows exporting user data to CSV',  // Optional but recommended
    group: 'Users',               // Must match the group name
    isSystem: true,               // Always true for system permissions
  },
];
```

### Step 2: Validate

Run the validation function:

```typescript
import { validateSystemPermissions } from '@common/rbac';

const result = validateSystemPermissions();
if (!result.isValid) {
  console.error('Permission errors:', result.errors);
}
```

### Step 3: Verify Build

```bash
npm run build
npm run lint
```

### Step 4: Document

Update this contract and any relevant API documentation.

---

## 8. What Is Intentionally NOT Implemented in Phase 2

### NOT Implemented (Deferred to Later Phases)

| Feature | Phase | Reason |
|---------|-------|--------|
| `@Permissions()` decorator | Phase 4 | Requires guard implementation |
| `PermissionsGuard` | Phase 4 | Requires decorator and effective permissions |
| `@Public()` decorator | Phase 4 | Requires guard implementation |
| RBAC effective permissions logic | Phase 4 | Requires guard and permission resolution |
| Permission enforcement on controllers | Phase 4 | Applied after guards are ready |
| Swagger decorators | Phase 6 | Documentation comes after API stabilization |
| Logging interceptors | Phase 7/8 | Request logging separate from permissions |
| Audit behavior in use-cases | Phase 8 | Audit comes after basic structure |
| Seed script | Phase 9 | Depends on this source of truth existing |

### Phase 2 Scope Summary

✅ **Done**:
- Central permission definitions
- Type-safe types
- Utility functions
- Validation functions
- Documentation

❌ **Not Done**:
- Guards and decorators
- Controller-level enforcement
- Seed script
- Audit logging

---

## 9. File Structure

```
src/common/rbac/
├── index.ts                    # Public API exports
├── permission.types.ts         # TypeScript interfaces
├── system-permissions.ts       # Central source of truth
└── permission.utils.ts         # Utility functions

docs/rbac/
└── system-permissions-contract.md  # This document
```

---

## 10. Validation

The system includes built-in validation:

```typescript
import { validateSystemPermissions } from '@common/rbac';

const result = validateSystemPermissions();

console.log(`Total permissions: ${result.totalCount}`);
console.log(`Valid: ${result.isValid}`);
console.log(`Errors: ${result.errors}`);
```

### Validation Checks

1. **No duplicate keys** - Each permission key appears only once
2. **Required fields** - Every permission has key, resource, action, label, group, isSystem
3. **Key format** - Keys use dot notation, lowercase, no trailing/leading dots
4. **Key count** - SYSTEM_PERMISSION_KEYS length matches SYSTEM_PERMISSIONS length

---

## 11. Future Extensions

### Adding New Permission Groups

To add a new group (e.g., "Products"):

1. Create the permissions array:
```typescript
const PRODUCTS_PERMISSIONS: SystemPermissionDefinition[] = [
  {
    key: 'products.read',
    resource: 'products',
    action: 'read',
    label: 'View products',
    description: 'Allows viewing products',
    group: 'Products',
    isSystem: true,
  },
];
```

2. Add to SYSTEM_PERMISSION_GROUPS:
```typescript
export const SYSTEM_PERMISSION_GROUPS: SystemPermissionGroup[] = [
  // ... existing groups
  { name: 'Products', permissions: PRODUCTS_PERMISSIONS },
];
```

3. Validate and build

### Adding New Actions

Standard actions are: `read`, `create`, `update`, `delete`

For compound actions, use dot notation: `status.update`, `permissions.update`, `health.read`

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-06-09 | Initial version with 24 permissions across 7 groups |

---

## Sign-Off

| Checkpoint | Status |
|------------|--------|
| Single source of truth defined | ✅ |
| No hardcoded permission strings | ✅ |
| Type-safe permission keys | ✅ |
| Utility functions available | ✅ |
| Validation function available | ✅ |
| Documentation complete | ✅ |
| Build succeeds | ✅ |
| Lint passes | ✅ |
| Prisma schema valid | ✅ |