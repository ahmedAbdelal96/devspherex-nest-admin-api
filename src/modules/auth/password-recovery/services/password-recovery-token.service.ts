/**
 * Password Recovery Token Service
 *
 * Generates cryptographically secure one-time artifacts used by the
 * password-recovery flow:
 *   - OTP: numeric code of length N, generated from crypto.randomInt
 *   - Reset session token secret: 32 random bytes (64 hex chars)
 *
 * Both are safe by default (no Math.random, no predictable seeds).
 */

import { Injectable } from '@nestjs/common';
import { randomBytes, randomInt } from 'crypto';
import { PasswordRecoveryConfig } from '../password-recovery.config';
import {
  PASSWORD_RECOVERY_RESET_TOKEN_SECRET_BYTES,
} from '../password-recovery.constants';

@Injectable()
export class PasswordRecoveryTokenService {
  constructor(private readonly config: PasswordRecoveryConfig) {}

  /**
   * Generate a numeric OTP of the configured length.
   * Always produces a zero-padded string (e.g., "004215").
   */
  generateOtp(): string {
    const length = this.config.otpLength;
    const max = 10 ** length;
    const value = randomInt(0, max);
    return value.toString().padStart(length, '0');
  }

  /**
   * Generate a cryptographically random secret for the reset session token.
   * The reset session token is the challengeId + '.' + this secret.
   */
  generateResetTokenSecret(): string {
    return randomBytes(
      PASSWORD_RECOVERY_RESET_TOKEN_SECRET_BYTES,
    ).toString('hex');
  }

  /**
   * Compose a reset session token from a challenge id and a random secret.
   */
  buildResetSessionToken(challengeId: string, secret: string): string {
    return `${challengeId}.${secret}`;
  }

  /**
   * Extract the challenge id from a reset session token.
   * Returns null if the token is malformed.
   */
  extractChallengeId(resetSessionToken: string): string | null {
    if (typeof resetSessionToken !== 'string' || resetSessionToken.length === 0) {
      return null;
    }
    const dotIndex = resetSessionToken.indexOf('.');
    if (dotIndex <= 0 || dotIndex === resetSessionToken.length - 1) {
      return null;
    }
    return resetSessionToken.substring(0, dotIndex);
  }

  /**
   * Extract the secret portion of a reset session token.
   * Returns null if the token is malformed.
   */
  extractSecret(resetSessionToken: string): string | null {
    if (typeof resetSessionToken !== 'string' || resetSessionToken.length === 0) {
      return null;
    }
    const dotIndex = resetSessionToken.indexOf('.');
    if (dotIndex <= 0 || dotIndex === resetSessionToken.length - 1) {
      return null;
    }
    return resetSessionToken.substring(dotIndex + 1);
  }
}
