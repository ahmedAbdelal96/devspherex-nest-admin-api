/**
 * API Tags — central registry of Swagger tag names.
 * Use these constants when adding tags to controller decorators.
 */

export const API_TAG_AUTH = 'Auth';
export const API_TAG_USERS = 'Users';
export const API_TAG_ROLES = 'Roles';
export const API_TAG_PERMISSIONS = 'Permissions';
export const API_TAG_AUDIT_LOGS = 'Audit Logs';
export const API_TAG_API_REQUEST_LOGS = 'API Request Logs';

/** All tags in display order */
export const API_TAGS = [
  API_TAG_AUTH,
  API_TAG_USERS,
  API_TAG_ROLES,
  API_TAG_PERMISSIONS,
  API_TAG_AUDIT_LOGS,
  API_TAG_API_REQUEST_LOGS,
] as const;