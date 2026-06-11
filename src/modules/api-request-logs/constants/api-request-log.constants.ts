/**
 * API Request Log Outcome Constants
 */
export const API_REQUEST_OUTCOME = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
} as const;

export type ApiRequestOutcome = (typeof API_REQUEST_OUTCOME)[keyof typeof API_REQUEST_OUTCOME];

/**
 * Paths that should be skipped from request logging.
 */
export const SKIPPED_PATTERNS = [
  '/health',
  '/favicon',
  '/static',
] as const;

/**
 * Maximum field lengths to prevent huge values in DB.
 */
export const MAX_PATH_LENGTH = 2048;
export const MAX_USER_AGENT_LENGTH = 512;