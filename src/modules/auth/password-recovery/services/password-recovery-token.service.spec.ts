/**
 * Password Recovery Token Service — Unit Tests
 *
 * Tests generateOtp, generateResetTokenSecret, buildResetSessionToken,
 * extractChallengeId, extractSecret.
 */

import { PasswordRecoveryTokenService } from './password-recovery-token.service';
import { PasswordRecoveryConfig } from '../password-recovery.config';

/**
 * Lightweight config double — bypasses ConfigService entirely so tests
 * don't depend on the mock factory correctly handling get<string>() calls.
 */
function buildService(otpLength = 6): PasswordRecoveryTokenService {
  const config = {
    enabled: true,
    channel: 'CONSOLE' as const,
    otpLength,
    otpTtlSeconds: 300,
    resetTokenTtlSeconds: 600,
    resendCooldownSeconds: 60,
    maxVerifyAttempts: 5,
    revokeSessionsOnSuccess: true,
    pepper: 'test-pepper-for-hashing-32chars!!',
    devReturnOtp: false,
    minResponseMs: 0,
    nodeEnv: 'development',
    get isProduction() { return false; },
  } as unknown as PasswordRecoveryConfig;
  return new PasswordRecoveryTokenService(config);
}

describe('PasswordRecoveryTokenService', () => {
  describe('generateOtp', () => {
    it('produces a string of configured length', () => {
      const svc = buildService(6);
      const otp = svc.generateOtp();
      expect(otp).toHaveLength(6);
    });

    it('produces numeric string', () => {
      const svc = buildService(6);
      const otp = svc.generateOtp();
      expect(otp).toMatch(/^\d+$/);
    });

    it('is zero-padded for small values', () => {
      const svc = buildService(6);
      const otp = svc.generateOtp();
      // If the random value is less than 10^5, it should still be 6 digits
      expect(otp).toMatch(/^\d{6}$/);
    });

    it('respects configured otpLength', () => {
      const svc = buildService(8);
      const otp = svc.generateOtp();
      expect(otp).toHaveLength(8);
    });
  });

  describe('generateResetTokenSecret', () => {
    it('produces a 64-character hex string (32 bytes)', () => {
      const svc = buildService();
      const secret = svc.generateResetTokenSecret();
      expect(secret).toHaveLength(64);
      expect(secret).toMatch(/^[a-f0-9]+$/);
    });

    it('produces unique values across calls', () => {
      const svc = buildService();
      const s1 = svc.generateResetTokenSecret();
      const s2 = svc.generateResetTokenSecret();
      expect(s1).not.toBe(s2);
    });
  });

  describe('buildResetSessionToken', () => {
    it('combines challengeId and secret with a dot', () => {
      const svc = buildService();
      const token = svc.buildResetSessionToken('challenge-abc', 'secret-def');
      expect(token).toBe('challenge-abc.secret-def');
    });
  });

  describe('extractChallengeId', () => {
    it('extracts challengeId from valid token', () => {
      const svc = buildService();
      expect(svc.extractChallengeId('challenge-abc.secret-def')).toBe('challenge-abc');
    });

    it('returns null for empty string', () => {
      const svc = buildService();
      expect(svc.extractChallengeId('')).toBeNull();
    });

    it('returns null for non-string', () => {
      const svc = buildService();
      expect(svc.extractChallengeId(null as never)).toBeNull();
      expect(svc.extractChallengeId(undefined as never)).toBeNull();
    });

    it('returns null for token with no dot', () => {
      const svc = buildService();
      expect(svc.extractChallengeId('no-dot-here')).toBeNull();
    });

    it('returns null for token starting with dot', () => {
      const svc = buildService();
      expect(svc.extractChallengeId('.secret')).toBeNull();
    });

    it('returns null for token ending with dot', () => {
      const svc = buildService();
      expect(svc.extractChallengeId('challenge.')).toBeNull();
    });
  });

  describe('extractSecret', () => {
    it('extracts secret from valid token', () => {
      const svc = buildService();
      expect(svc.extractSecret('challenge-abc.secret-def')).toBe('secret-def');
    });

    it('returns null for empty string', () => {
      const svc = buildService();
      expect(svc.extractSecret('')).toBeNull();
    });

    it('returns null for non-string', () => {
      const svc = buildService();
      expect(svc.extractSecret(null as never)).toBeNull();
    });

    it('returns null for token with no dot', () => {
      const svc = buildService();
      expect(svc.extractSecret('no-dot-here')).toBeNull();
    });

    it('returns null for token ending with dot', () => {
      const svc = buildService();
      expect(svc.extractSecret('challenge.')).toBeNull();
    });
  });
});
