/**
 * Password Recovery Constants
 *
 * Centralized constants used by the password-recovery module.
 * Do not hardcode these values inside services or use-cases.
 */

/** Default OTP length when env variable is not provided. */
export const PASSWORD_RECOVERY_DEFAULT_OTP_LENGTH = 6;

/** Default OTP TTL in seconds (5 minutes). */
export const PASSWORD_RECOVERY_DEFAULT_OTP_TTL_SECONDS = 300;

/** Default reset session token TTL in seconds (10 minutes). */
export const PASSWORD_RECOVERY_DEFAULT_RESET_TOKEN_TTL_SECONDS = 600;

/** Default cooldown between resend requests in seconds (1 minute). */
export const PASSWORD_RECOVERY_DEFAULT_RESEND_COOLDOWN_SECONDS = 60;

/** Default maximum failed verification attempts. */
export const PASSWORD_RECOVERY_DEFAULT_MAX_VERIFY_ATTEMPTS = 5;

/** Bytes of entropy for the reset session token secret (32 bytes => 64 hex chars). */
export const PASSWORD_RECOVERY_RESET_TOKEN_SECRET_BYTES = 32;

/** Generic public response for the forgot-password endpoint (no enumeration). */
export const PASSWORD_RECOVERY_GENERIC_MESSAGE =
  'If this email exists, password recovery instructions will be sent.';

/** Message returned after a successful reset. */
export const PASSWORD_RECOVERY_RESET_SUCCESS_MESSAGE =
  'Password has been reset successfully.';

/** Feature-disabled message returned when password recovery is turned off. */
export const PASSWORD_RECOVERY_DISABLED_MESSAGE =
  'Password recovery is not available at the moment.';
