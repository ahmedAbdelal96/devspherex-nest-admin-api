/**
 * Password Recovery Hashing Service
 *
 * Centralized hashing utilities for password recovery:
 *   - Normalize and hash email (HMAC-SHA256 with server pepper)
 *   - Hash OTP using a challenge-specific input (HMAC-SHA256 with server pepper)
 *   - Hash reset session token (HMAC-SHA256 with server pepper)
 *
 * Notes:
 *   - HMAC-SHA256 is deterministic, which is what we want for OTP/email
 *     equality checks. Plain bcrypt would not work here because we cannot
 *     recover the original input.
 *   - The pepper is a server-side secret loaded from PASSWORD_RECOVERY_PEPPER.
 *     It is never logged and never returned to clients.
 *   - This service intentionally uses Node's built-in crypto module only,
 *     to avoid adding new dependencies to the project.
 */

import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PasswordRecoveryConfig } from '../password-recovery.config';

@Injectable()
export class PasswordRecoveryHashingService {
  constructor(private readonly config: PasswordRecoveryConfig) {}

  /**
   * Normalize an email address and compute its HMAC-SHA256 hash using the
   * server pepper. The raw email is never stored; only the hash is used for
   * challenge lookup.
   */
  hashEmail(email: string): string {
    return this.hmac(this.normalizeEmail(email));
  }

  /**
   * Hash a one-time password using the challenge id as a salt-like input.
   * The hash is challenge-specific, so the same OTP value cannot be matched
   * against a different challenge.
   */
  hashOtp(challengeId: string, otp: string): string {
    return this.hmac(`${challengeId}:${otp}`);
  }

  /**
   * Hash a reset session token (format: `${challengeId}.${secret}`).
   * The hash is challenge-specific.
   */
  hashResetToken(challengeId: string, secret: string): string {
    return this.hmac(`${challengeId}.${secret}`);
  }

  /**
   * Constant-time comparison of two hex-encoded hashes.
   *
   * Uses Node's `timingSafeEqual` over `Uint8Array` to avoid leaking the
   * position of the first differing byte. Inputs of mismatched length or
   * non-hex content short-circuit to `false` (length-leak is acceptable
   * for hex strings of identical algorithms, but a malformed hex value
   * is treated as a non-match rather than a thrown error so callers can
   * treat all invalid-token cases uniformly).
   */
  safeEqual(a: string, b: string): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    if (a.length % 2 !== 0) return false;
    try {
      const aBytes = new Uint8Array(a.length / 2);
      const bBytes = new Uint8Array(b.length / 2);
      for (let i = 0; i < aBytes.length; i++) {
        const byte = parseInt(a.substr(i * 2, 2), 16);
        const byteB = parseInt(b.substr(i * 2, 2), 16);
        if (Number.isNaN(byte) || Number.isNaN(byteB)) return false;
        aBytes[i] = byte;
        bBytes[i] = byteB;
      }
      return timingSafeEqual(aBytes, bBytes);
    } catch {
      return false;
    }
  }

  /**
   * Normalize an email address: trim + lowercase.
   */
  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private hmac(input: string): string {
    const pepper = this.config.pepper;
    if (!pepper) {
      throw new Error(
        'PASSWORD_RECOVERY_PEPPER is not configured. Refusing to hash without a pepper.',
      );
    }
    return createHmac('sha256', pepper).update(input, 'utf8').digest('hex');
  }
}
