/**
 * Verify Password Recovery OTP Use-Case
 *
 * Step 2 of the password recovery flow. Public endpoint, no authentication.
 *
 * Security contract:
 *   - Returns a single generic error for any failure (not found, expired,
 *     revoked, consumed, max attempts, wrong OTP). No user enumeration.
 *   - If the OTP is wrong, failedAttempts is incremented atomically.
 *     When failedAttempts reaches maxAttempts the challenge is revoked
 *     immediately.
 *   - On success, generates a reset session token (`<challengeId>.<secret>`),
 *     stores only its HMAC hash, and returns the raw token to the client
 *     once. The token is short-lived (configurable TTL).
 *   - The same challenge can only be verified once (otpVerifiedAt is set
 *     inside a conditional update guarded by `otpVerifiedAt: null`).
 */

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PasswordRecoveryConfig } from '../password-recovery.config';
import { PasswordRecoveryHashingService } from '../services/password-recovery-hashing.service';
import { PasswordRecoveryTokenService } from '../services/password-recovery-token.service';
import { PasswordRecoveryPolicyService } from '../services/password-recovery-policy.service';
import { PasswordRecoveryRepository } from '../repositories/password-recovery.repository';
import { PASSWORD_RECOVERY_PURPOSES } from '../password-recovery.types';

const GENERIC_OTP_ERROR = 'Invalid or expired verification code.';

@Injectable()
export class VerifyPasswordRecoveryOtpUseCase {
  private readonly logger = new Logger(VerifyPasswordRecoveryOtpUseCase.name);

  constructor(
    private readonly config: PasswordRecoveryConfig,
    private readonly hashing: PasswordRecoveryHashingService,
    private readonly tokens: PasswordRecoveryTokenService,
    private readonly policy: PasswordRecoveryPolicyService,
    private readonly repository: PasswordRecoveryRepository,
  ) {}

  async execute(
    rawEmail: string,
    otp: string,
  ): Promise<{ resetSessionToken: string; expiresIn: number }> {
    if (!this.config.enabled) {
      throw new UnauthorizedException('Password recovery is not available');
    }

    const normalizedEmail = this.hashing.normalizeEmail(rawEmail);
    const emailHash = this.hashing.hashEmail(normalizedEmail);

    const challenge = await this.repository.findLatestActiveByEmail(
      emailHash,
      PASSWORD_RECOVERY_PURPOSES.PASSWORD_RESET,
    );

    // Use a single generic message for every failure path.
    if (!challenge) {
      throw new UnauthorizedException(GENERIC_OTP_ERROR);
    }
    if (challenge.revokedAt || challenge.consumedAt) {
      throw new UnauthorizedException(GENERIC_OTP_ERROR);
    }
    if (!challenge.otpExpiresAt) {
      // Markers and any challenge without an OTP expiry cannot be
      // verified. findLatestActiveByEmail already filters markers, but
      // this check defends against future schema variants.
      throw new UnauthorizedException(GENERIC_OTP_ERROR);
    }
    if (challenge.otpExpiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException(GENERIC_OTP_ERROR);
    }
    if (challenge.failedAttempts >= challenge.maxAttempts) {
      throw new UnauthorizedException(GENERIC_OTP_ERROR);
    }
    if (challenge.otpVerifiedAt) {
      // Already verified — refuse re-verification. The existing reset
      // token (if any) is the only way forward.
      throw new UnauthorizedException(GENERIC_OTP_ERROR);
    }

    // Verify OTP using challenge-id-bound hash.
    const expectedHash = this.hashing.hashOtp(challenge.id, otp);
    const ok = this.hashing.safeEqual(expectedHash, challenge.otpHash ?? '');
    if (!ok) {
      // Increment failed attempts atomically. If we just hit the max, the
      // repository will revoke the challenge as part of the same tx.
      await this.repository.incrementFailedAttempts(
        challenge.id,
        challenge.maxAttempts,
      );
      throw new UnauthorizedException(GENERIC_OTP_ERROR);
    }

    // OTP is correct — issue a reset session token.
    const secret = this.tokens.generateResetTokenSecret();
    const resetTokenExpiresAt = this.policy.computeResetTokenExpiresAt();
    const resetTokenHash = this.hashing.hashResetToken(challenge.id, secret);

    const updated = await this.repository.markOtpVerified(
      challenge.id,
      resetTokenHash,
      resetTokenExpiresAt,
    );

    if (!updated) {
      // Race condition: someone else verified or revoked this challenge
      // between our read and our conditional update. Refuse safely.
      this.logger.warn(
        `Race condition on challenge ${challenge.id}: conditional markOtpVerified returned 0 rows`,
      );
      throw new UnauthorizedException(GENERIC_OTP_ERROR);
    }

    const resetSessionToken = this.tokens.buildResetSessionToken(
      challenge.id,
      secret,
    );

    return {
      resetSessionToken,
      expiresIn: this.policy.getResetTokenTtlSeconds(),
    };
  }
}
