# Seed System

**Phase:** 9

---

## Purpose

The seed system populates the database with an initial set of system data — permissions, roles, and an admin user — for new template setups, local development, and CI environments.

It is designed to be **modular** (one file per domain), **idempotent** (safe to run multiple times), and **safe by default** (reset mode is guarded).

---

## Folder Structure

```
prisma/
  seed/
    main.seed.ts              — Entry point, orchestrates all seeders
    seed.types.ts             — Shared types (SeedMode, SeedContext, ModuleSeeder, SeedStats)
    seed.logger.ts            — Structured logger with sensitive-value redaction
    seed.registry.ts          — Ordered seeder list + validation
    seed.spec.ts              — Tests (in src/test-utils/)
    modules/
      permissions.seed.ts     — Seeds system permissions from SYSTEM_PERMISSIONS
      roles.seed.ts           — Seeds super-admin, admin, viewer roles
      users.seed.ts           — Seeds the default admin user
```

---

## Seed Modes

### Upsert Mode (Default)

```bash
npm run db:seed
```

- Does **not** delete existing data
- Uses `upsert` on stable identifiers (permission key, role slug, user email)
- Updates seed-owned records if they already exist
- Safe to run multiple times — no duplicates, no data loss
- Logs created/updated/skipped counts per module

### Reset Mode

```bash
ALLOW_SEED_RESET=true npm run db:seed:reset
```

- **Requires** `ALLOW_SEED_RESET=true` environment variable — refuses to run without it
- Deletes seed-owned records by stable identifiers only:
  - Permissions: deleted by keys in `SYSTEM_PERMISSION_KEYS`
  - Roles: deleted by known seed slugs (`super-admin`, `admin`, `viewer`)
  - Users: deleted by known seed email (`admin@example.com`)
- Does **not** delete all records blindly
- Then recreates fresh seed data via upsert
- Intended for local/dev/template setup only

---

## Commands

| Command | Mode | Description |
|---------|------|-------------|
| `npm run db:seed` | upsert | Default seed — safe, idempotent |
| `npm run db:seed:upsert` | upsert | Explicit upsert mode |
| `npm run db:seed:reset` | reset | Dangerous — requires `ALLOW_SEED_RESET=true` |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SEED_ADMIN_PASSWORD` | In production | Password for the admin user |
| `ALLOW_SEED_RESET` | For reset mode | Must be `true` to enable reset |

### Admin Password Resolution

- If `SEED_ADMIN_PASSWORD` is set → use it
- If not set in `development` mode → use `Admin@123456` (dev-only fallback, logged with warning)
- If not set in `production` mode → **exit with error** — password must be provided

---

## Seeded Data

### Permissions (24 total, from SYSTEM_PERMISSIONS)

All permissions are sourced directly from `SYSTEM_PERMISSIONS` (the central source of truth in `src/common/rbac/system-permissions.ts`). No manual duplication.

Groups: Auth, Users, Roles, Permissions, Audit Logs, API Request Logs, System.

### Roles (3 total)

| Role | Slug | Permissions |
|------|------|-------------|
| Super Admin | `super-admin` | All 24 system permissions |
| Admin | `admin` | Full admin subset (users, roles management + read on permissions/audit) |
| Viewer | `viewer` | Read-only permissions only |

### Users (1 default)

| Field | Value |
|-------|-------|
| Email | `admin@example.com` |
| Name | `Admin` |
| Role | `super-admin` |
| Password | From `SEED_ADMIN_PASSWORD` env or dev fallback |

---

## Adding a Seed Module

1. Create `prisma/seed/modules/<name>.seed.ts`
2. Export `seed(ctx: SeedContext): Promise<SeedStats>` and optionally `reset(ctx: SeedContext): Promise<SeedStats>`
3. Add to `prisma/seed/seed.registry.ts` in dependency order
4. The registry validates no duplicate names, all dependencies exist, and order is correct

---

## Dependency Ordering Rules

Seeders run in this order:

```
permissions → roles → users
```

- `permissions` has no dependencies
- `roles` depends on `permissions` (needs permission IDs to connect)
- `users` depends on `roles` (needs role ID for admin user)

In reset mode, seeders run in **reverse** order (users → roles → permissions) to respect foreign-key constraints.

---

## Security Notes

- Passwords are hashed with `bcrypt` (same algorithm used by the app)
- The seed logger **redacts** sensitive fields: `password`, `token`, `hash`, `secret`, `credential`, `otp`
- Reset mode is guarded — it refuses to run without `ALLOW_SEED_RESET=true`
- No production database should be reset without explicit opt-in
- Seed-owned records are identified by stable keys/slugs/emails, not by scanning all records

---

## Local Database Setup

If running seed against a local database (e.g. from `.env` `DATABASE_URL`):

1. Ensure the database exists. If it does not exist on `localhost`, create it:
   ```bash
   # Using Node.js (requires pg package)
   node -e "const{Pool}=require('pg');new Pool({connectionString:'postgresql://user:pass@localhost:5432/postgres'}).query('CREATE DATABASE mydb').then(r=>{console.log('created');process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)})"
   ```

2. Push the Prisma schema:
   ```bash
   npx prisma db push
   ```

3. Run the seed:
   ```bash
   npm run db:seed
   ```

---

## Upsert Mode Safety

In **upsert mode**, the seed system is additive and non-destructive:

- **Permissions**: upserts by `key`. Does not delete unknown DB permissions.
- **Roles**: upserts by `slug`. Does **not** call `deleteMany` on role permissions — existing role-permission links (including custom ones added by the template user) are preserved. Only missing seed permission links are created.
- **Users**: upserts by `email`. Does not affect other users.

In **reset mode**, seed-owned records are deleted by known identifiers (role slugs, permission keys, user emails), then recreated. This is destructive but limited to known seed records.