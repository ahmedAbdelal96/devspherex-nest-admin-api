/**
 * Permission Validation Script
 *
 * Run with: npx ts-node scripts/validate-permissions.ts
 *
 * This script validates the system permissions contract.
 */

import {
  SYSTEM_PERMISSION_KEYS,
  SYSTEM_PERMISSION_KEY_LIST,
  SYSTEM_PERMISSION_KEY_SET,
  SYSTEM_PERMISSIONS,
  SYSTEM_PERMISSION_GROUPS,
  getSystemPermissionByKey,
  validateSystemPermissions,
} from '../src/common/rbac/system-permissions';

console.log('=== System Permissions Validation ===\n');

// Run validation
const result = validateSystemPermissions();
console.log(`Validation: ${result.isValid ? 'PASSED' : 'FAILED'}`);
console.log(`Total permissions: ${result.totalCount}`);
console.log(`Errors: ${result.errors.length}`);

if (result.errors.length > 0) {
  console.log('\nErrors:');
  result.errors.forEach((e) => console.log(`  - ${e}`));
}

// Check key naming
console.log('\n=== Key Naming Check ===');
const camelCaseKeys = SYSTEM_PERMISSION_KEY_LIST.filter((k) => /[a-z][A-Z]/.test(k));
console.log(`CamelCase keys found: ${camelCaseKeys.length}`);
if (camelCaseKeys.length > 0) {
  camelCaseKeys.forEach((k) => console.log(`  - ${k}`));
}

// Check specific keys
console.log('\n=== Specific Key Values ===');
console.log(`SYSTEM_PERMISSION_KEYS.USERS.READ = "${SYSTEM_PERMISSION_KEYS.USERS.READ}"`);
console.log(`SYSTEM_PERMISSION_KEYS.AUDIT_LOGS.READ = "${SYSTEM_PERMISSION_KEYS.AUDIT_LOGS.READ}"`);
console.log(`SYSTEM_PERMISSION_KEYS.API_REQUEST_LOGS.READ = "${SYSTEM_PERMISSION_KEYS.API_REQUEST_LOGS.READ}"`);

// Check flat list
console.log('\n=== Flat List ===');
console.log(`SYSTEM_PERMISSION_KEY_LIST.length = ${SYSTEM_PERMISSION_KEY_LIST.length}`);
console.log(`SYSTEM_PERMISSIONS.length = ${SYSTEM_PERMISSIONS.length}`);
console.log(`SYSTEM_PERMISSION_KEY_SET.size = ${SYSTEM_PERMISSION_KEY_SET.size}`);
console.log(`KEY_LIST === KEYS from definitions: ${SYSTEM_PERMISSION_KEY_LIST.length === SYSTEM_PERMISSIONS.length ? 'PASS' : 'FAIL'}`);
console.log(`SET size === LIST length: ${SYSTEM_PERMISSION_KEY_SET.size === SYSTEM_PERMISSION_KEY_LIST.length ? 'PASS' : 'FAIL'}`);

// Check getSystemPermissionByKey
console.log('\n=== Lookup Functions ===');
const usersRead = getSystemPermissionByKey('users.read');
console.log(`getSystemPermissionByKey("users.read"): ${usersRead ? 'Found' : 'NOT FOUND'}`);
const notFound = getSystemPermissionByKey('not.exists');
console.log(`getSystemPermissionByKey("not.exists"): ${notFound ? 'Found (BUG!)' : 'Undefined (correct)'}`);

// Final result
console.log('\n=== FINAL RESULT ===');
if (result.isValid && result.errors.length === 0 && camelCaseKeys.length === 0) {
  console.log('ALL CHECKS PASSED');
  process.exit(0);
} else {
  console.log('VALIDATION FAILED');
  process.exit(1);
}