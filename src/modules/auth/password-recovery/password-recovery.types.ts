/**
 * Password Recovery Types
 *
 * Internal types used by the password-recovery module.
 * These types are intentionally NOT exposed as DTOs to the API surface.
 */

export const PASSWORD_RECOVERY_PURPOSES = {
  PASSWORD_RESET: 'PASSWORD_RESET',
} as const;

export type PasswordRecoveryPurpose =
  (typeof PASSWORD_RECOVERY_PURPOSES)[keyof typeof PASSWORD_RECOVERY_PURPOSES];

export const PASSWORD_RECOVERY_CHANNELS = {
  EMAIL: 'EMAIL',
  WHATSAPP: 'WHATSAPP',
  SMS: 'SMS',
  NOOP: 'NOOP',
  CONSOLE: 'CONSOLE',
} as const;

export type PasswordRecoveryChannel =
  (typeof PASSWORD_RECOVERY_CHANNELS)[keyof typeof PASSWORD_RECOVERY_CHANNELS];

/**
 * Payload sent to a delivery channel when an OTP is generated.
 */
export interface PasswordRecoveryChannelPayload {
  to: string;
  otp: string;
  purpose: PasswordRecoveryPurpose;
  expiresInSeconds: number;
}
