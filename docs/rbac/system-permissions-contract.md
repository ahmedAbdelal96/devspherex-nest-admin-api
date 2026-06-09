# System Permissions Contract

## Phase 2-R1 - Permission Keys Contract & Validation

---

## 1. Why Permissions Must Have One Source of Truth

All permissions are defined **once** in `src/common/rbac/system-permissions.ts`.

Every other part of the system imports from this single source:
- Controllers/decorators import `SYSTEM_PERMISSION_KEYS`
- Guards validate against `SYSTEM_PERMISSION_KEY_SET`
- Seed scripts import `SYSTEM_PERMISSIONS` for database seeding

---

## 2. Permission Naming Convention

### Format: `resource.action`

All permission keys follow dot notation: `resource.action`

### Rules

1. **Always lowercase**: `users.read` not `Users.Read`
2. **Multi-word resources use kebab-case**: `audit-logs`, `api-request-logs`
3. **Dot notation for compound actions**: `status.update`, `permissions.update`
4. **No trailing/leading dots**: `users.read` not `users.read.`

### Examples

| Key | Resource | Action | Description |
|-----|----------|--------|-------------|
| `users.read` | users | read | View user list |
| `users.create` | users | create | Create new user |
| `audit-logs.read` | audit-logs | read | View audit logs |
| `api-request-logs.read` | api-request-logs | read | View API request logs |

### Multi-Word Resources (kebab-case)

| Resource | Example Keys |
|----------|-------------|
| `audit-logs` | `audit-logs.read`, `audit-logs.create` |
| `api-request-logs` | `api-request-logs.read` |

---

## 3. Permission Groups

| Group | Permission Count |
|-------|------------------|
| Auth | 2 |
| Users | 8 |
| Roles | 6 |
| Permissions | 2 |
| Audit Logs | 2 |
| API Request Logs | 1 |
| System | 3 |
| **Total** | **24** |

---

## 4. All Current System Permissions

### Auth Group

| Key | Label |
|-----|-------|
| `auth.me.read` | View own account |
| `auth.password.change` | Change password |

### Users Group

| Key | Label |
|-----|-------|
| `users.read` | View users |
| `users.create` | Create users |
| `users.update` | Update users |
| `users.delete` | Delete users |
| `users.status.update` | Update user status |
| `users.role.update` | Update user role |
| `users.permissions.read` | View user permissions |
| `users.permissions.override` | Override user permissions |

### Roles Group

| Key | Label |
|-----|-------|
| `roles.read` | View roles |
| `roles.create` | Create roles |
| `roles.update` | Update roles |
| `roles.delete` | Delete roles |
| `roles.permissions.update` | Update role permissions |
| `roles.duplicate` | Duplicate roles |

### Permissions Group

| Key | Label |
|-----|-------|
| `permissions.read` | View permissions |
| `permissions.grouped.read` | View grouped permissions |

### Audit Logs Group

| Key | Label |
|-----|-------|
| `audit-logs.read` | View audit logs |
| `audit-logs.create` | Create audit log entries |

### API Request Logs Group

| Key | Label |
|-----|-------|
| `api-request-logs.read` | View API request logs |

### System Group

| Key | Label |
|-----|-------|
| `system.health.read` | View system health |
| `settings.read` | View settings |
| `settings.update` | Update settings |

---

## 5. API Usage

### Import

```typescript
import { SYSTEM_PERMISSION_KEYS, SYSTEM_PERMISSION_KEY_LIST, getSystemPermissionByKey } from '@common/rbac';
import { SYSTEM_PERMISSIONS } from '@common/rbac/system-permissions';
```

### Namespaced Keys (Recommended)

```typescript
// Use dot notation for access
@Permissions(SYSTEM_PERMISSION_KEYS.USERS.READ)
@Permissions(SYSTEM_PERMISSION_KEYS.AUDIT_LOGS.READ)
@Permissions(SYSTEM_PERMISSION_KEYS.API_REQUEST_LOGS.READ)
```

### Flat Key List

```typescript
// For iteration or validation
for (const key of SYSTEM_PERMISSION_KEY_LIST) {
  console.log(key);
}
```

### Lookup

```typescript
const perm = getSystemPermissionByKey('users.read');
if (perm) {
  console.log(perm.label); // "View users"
}
```

---

## 6. Validation

Run validation with:

```bash
npx ts-node scripts/validate-permissions.ts
```

Validation checks:
- No duplicate keys
- All keys use lowercase dot notation
- No camelCase keys (e.g., `auditLogs.read` is rejected)
- Resource is lowercase kebab-case for multi-word resources
- KEY_LIST, KEY_SET, and SYSTEM_PERMISSIONS are in sync

---

## 7. Files

```
src/common/rbac/
├── index.ts                    # Public API exports
├── permission.types.ts         # TypeScript interfaces
├── system-permissions.ts       # Central source of truth (24 permissions)
└── permission.utils.ts         # Utility functions

scripts/
└── validate-permissions.ts     # Validation script (run with: npx ts-node scripts/validate-permissions.ts)
```

**Note:** Test file not created due to missing `@types/jest`. Validation is done via the script above.

---

## 8. Future Seed Script (Phase 9)

The seed script will import from `SYSTEM_PERMISSIONS`:

```typescript
import { SYSTEM_PERMISSIONS } from '../src/common/rbac/system-permissions';

for (const permission of SYSTEM_PERMISSIONS) {
  await prisma.permission.upsert({
    where: { key: permission.key },
    update: {},
    create: { ...permission },
  });
}
```

---

## 9. Adding New Permissions

1. Add key to `SYSTEM_PERMISSION_KEYS` namespace
2. Add definition to the appropriate group array
3. Run `npx ts-node scripts/validate-permissions.ts` to verify

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2026-06-09 | R1 - Fixed camelCase keys, namespaced object, kebab-case resources |
| 1.0.0 | 2026-06-09 | Initial Phase 2 release |

---

## Sign-Off

| Checkpoint | Status |
|------------|--------|
| Single source of truth | ✅ |
| Namespaced keys object | ✅ |
| Flat key list (KEY_LIST) | ✅ |
| kebab-case for multi-word resources | ✅ |
| No camelCase keys | ✅ |
| Validation script | ✅ |
| Build succeeds | ✅ |
| Lint passes | ✅ |
| Prisma schema valid | ✅ |