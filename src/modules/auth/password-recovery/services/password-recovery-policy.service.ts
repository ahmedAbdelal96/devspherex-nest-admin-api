/**
 * Password Recovery Policy Service
 *
 * Encapsulates the rules of the password-recovery flow that depend on
 * configuration values. Use-cases ask the policy "is this allowed?" and
 * "what should the expiry be?" instead of reading config directly.
 *
 * Keeping policy here means future tunings (e.g., per-tenant cooldown)
 * only need to change this service.
 */

import { Injectable } from '@nestjs/common';
import { PasswordRecoveryConfig } from '../password-recovery.config';
import { PasswordRecoveryChallenge } from '@prisma/client';

@Injectable()
export class PasswordRecoveryPolicyService {
  constructor(private readonly config: PasswordRecoveryConfig) {}

  /**
   * Returns true if a new OTP can be issued right now, given the latest
   * challenge for this emailHash + purpose. The check is per-emailHash so
   * it works for both known and unknown emails (cooldown applies to the
   * email address itself, not to a specific user record).
   */
  isWithinResendCooldown(
    latestChallenge: PasswordRecoveryChallenge | null,
  ): boolean {
    if (!latestChallenge) return false;
    if (this.config.resendCooldownSeconds <= 0) return false;
    const elapsedMs = Date.now() - latestChallenge.createdAt.getTime();
    return elapsedMs < this.config.resendCooldownSeconds * 1000;
  }

  /**
   * Returns the expiry date for a newly created OTP.
   */
  computeOtpExpiresAt(): Date {
    return new Date(Date.now() + this.config.otpTtlSeconds * 1000);
  }

  /**
   * Returns the expiry date for a newly issued reset session token.
   */
  computeResetTokenExpiresAt(): Date {
    return new Date(Date.now() + this.config.resetTokenTtlSeconds * 1000);
  }

  /**
   * Returns the lifetime of the reset session token in seconds.
   * Used for the `expiresIn` field in the verify-otp response.
   */
  getResetTokenTtlSeconds(): number {
    return this.config.resetTokenTtlSeconds;
  }

  /**
   * Returns the configured max attempts for verification.
   */
  getMaxAttempts(): number {
    return this.config.maxVerifyAttempts;
  }
}
