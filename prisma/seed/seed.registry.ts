/**
 * Seed Registry
 *
 * Ordered list of module seeders. Order must respect dependencies:
 *   permissions → roles → users
 */

import type { ModuleSeeder } from './seed.types';
import { seedPermissions, resetPermissions } from './modules/permissions.seed';
import { seedRoles, resetRoles } from './modules/roles.seed';
import { seedUsers, resetUsers } from './modules/users.seed';

export const seeders: ModuleSeeder[] = [
  {
    name: 'permissions',
    dependencies: [],
    seed: seedPermissions,
    reset: resetPermissions,
  },
  {
    name: 'roles',
    dependencies: ['permissions'],
    seed: seedRoles,
    reset: resetRoles,
  },
  {
    name: 'users',
    dependencies: ['roles'],
    seed: seedUsers,
    reset: resetUsers,
  },
];

// ─── Validation ─────────────────────────────────────────────────────────────

const seenNames = new Set<string>();
for (const seeder of seeders) {
  if (seenNames.has(seeder.name)) {
    throw new Error(`Duplicate seeder name in registry: "${seeder.name}"`);
  }
  seenNames.add(seeder.name);
}

// Validate dependencies exist
for (const seeder of seeders) {
  for (const dep of seeder.dependencies ?? []) {
    if (!seenNames.has(dep)) {
      throw new Error(`Seeder "${seeder.name}" depends on "${dep}" but it is not in the registry`);
    }
  }
}

// Validate dependency order (dependency appears before dependent)
for (let i = 0; i < seeders.length; i++) {
  const seeder = seeders[i];
  for (const dep of seeder.dependencies ?? []) {
    const depIndex = seeders.findIndex((s) => s.name === dep);
    if (depIndex >= i) {
      throw new Error(
        `Seeder "${seeder.name}" (index ${i}) must come after its dependency "${dep}" (index ${depIndex})`,
      );
    }
  }
}

export function getSeeders(): ModuleSeeder[] {
  return seeders;
}

/**
 * Returns seeders in reverse dependency order (for reset: delete leaves first).
 */
export function getSeedersReversed(): ModuleSeeder[] {
  return [...seeders].reverse();
}