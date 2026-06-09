import { registerAs } from '@nestjs/config';

/**
 * Password Recovery configuration.
 *
 * Exposed at `config.passwordRecovery.*`. All values are read directly from
 * the environment; production-safety and range validation is performed in
 * `PasswordRecoveryConfig` at module construction time.
 */
export const passwordRecoveryConfig = registerAs('passwordRecovery', () => ({
  enabled: parseBool(process.env.PASSWORD_RECOVERY_ENABLED, true),
  channel: (process.env.PASSWORD_RECOVERY_CHANNEL || 'CONSOLE').toUpperCase(),
  otpLength: parseInt(process.env.PASSWORD_RECOVERY_OTP_LENGTH || '6', 10),
  otpTtlSeconds: parseInt(process.env.PASSWORD_RECOVERY_OTP_TTL_SECONDS || '300', 10),
  resetTokenTtlSeconds: parseInt(
    process.env.PASSWORD_RECOVERY_RESET_TOKEN_TTL_SECONDS || '600',
    10,
  ),
  resendCooldownSeconds: parseInt(
    process.env.PASSWORD_RECOVERY_RESEND_COOLDOWN_SECONDS || '60',
    10,
  ),
  maxAttempts: parseInt(process.env.PASSWORD_RECOVERY_MAX_VERIFY_ATTEMPTS || '5', 10),
  revokeSessionsOnSuccess: parseBool(
    process.env.PASSWORD_RECOVERY_REVOKE_SESSIONS_ON_SUCCESS,
    true,
  ),
  // Server-side pepper. Must be ≥16 chars in production (validated at boot).
  pepper:
    process.env.PASSWORD_RECOVERY_PEPPER ||
    'dev-only-pepper-please-override-in-production-32chars',
  // Dev-only: return the OTP in the response so integration tests can pick it up.
  // Refused in production (validated at boot).
  devReturnOtp: parseBool(process.env.PASSWORD_RECOVERY_DEV_RETURN_OTP, false),
  // Dev-only: prefix for the fake email address used by the NOOP channel's logs.
  devDestinationHint:
    process.env.PASSWORD_RECOVERY_DEV_DESTINATION_HINT || 'noop',
}));

/**
 * Best-effort boolean parser. Accepts "1", "true", "yes", "on" (case
 * insensitive) as truthy; "0", "false", "no", "off" as falsy; anything
 * else falls back to `defaultValue`.
 */
function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return defaultValue;
}

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL || 'postgresql://localhost:5432/devspherex_admin',
}));

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
}));

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  env: process.env.NODE_ENV || 'development',
}));
