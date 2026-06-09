/**
 * Password Recovery Hashing Service — Unit Tests
 *
 * Tests hashEmail, hashOtp, hashResetToken, safeEqual, normalizeEmail.
 * Uses a mock PasswordRecoveryConfig.
 */

import { PasswordRecoveryHashingService } from './password-recovery-hashing.service';
import { PasswordRecoveryConfig } from '../password-recovery.config';

/**
 * Lightweight config double — bypasses ConfigService entirely so tests
 * don't depend on the mock factory correctly handling get<string>() calls.
 */
function buildService(pepper = 'test-pepper-for-hashing-32c'): PasswordRecoveryHashingService {
  const config = {
    enabled: true,
    channel: 'CONSOLE' as const,
    otpLength: 6,
    otpTtlSeconds: 300,
    resetTokenTtlSeconds: 600,
    resendCooldownSeconds: 60,
    maxVerifyAttempts: 5,
    revokeSessionsOnSuccess: true,
    pepper,
    devReturnOtp: false,
    minResponseMs: 0,
    nodeEnv: 'development',
    get isProduction() { return false; },
  } as unknown as PasswordRecoveryConfig;
  return new PasswordRecoveryHashingService(config);
}

describe('PasswordRecoveryHashingService', () => {
  describe('normalizeEmail', () => {
    it('trims whitespace', () => {
      const svc = buildService();
      expect(svc.normalizeEmail('  test@example.com  ')).toBe('test@example.com');
    });

    it('lowerases', () => {
      const svc = buildService();
      expect(svc.normalizeEmail('Test@Example.COM')).toBe('test@example.com');
    });

    it('trims and lowerases combined', () => {
      const svc = buildService();
      expect(svc.normalizeEmail('  User@Domain.COM  ')).toBe('user@domain.com');
    });
  });

  describe('hashEmail', () => {
    it('is deterministic for same input', () => {
      const svc = buildService();
      const h1 = svc.hashEmail('test@example.com');
      const h2 = svc.hashEmail('test@example.com');
      expect(h1).toBe(h2);
    });

    it('different emails produce different hashes', () => {
      const svc = buildService();
      const h1 = svc.hashEmail('a@example.com');
      const h2 = svc.hashEmail('b@example.com');
      expect(h1).not.toBe(h2);
    });

    it('normalizes before hashing', () => {
      const svc = buildService();
      const h1 = svc.hashEmail('  TEST@EXAMPLE.COM  ');
      const h2 = svc.hashEmail('test@example.com');
      expect(h1).toBe(h2);
    });
  });

  describe('hashOtp', () => {
    it('depends on challengeId', () => {
      const svc = buildService();
      const h1 = svc.hashOtp('challenge-1', '123456');
      const h2 = svc.hashOtp('challenge-2', '123456');
      expect(h1).not.toBe(h2);
    });

    it('same challengeId + otp is deterministic', () => {
      const svc = buildService();
      const h1 = svc.hashOtp('challenge-1', '123456');
      const h2 = svc.hashOtp('challenge-1', '123456');
      expect(h1).toBe(h2);
    });

    it('different otp with same challengeId produces different hash', () => {
      const svc = buildService();
      const h1 = svc.hashOtp('challenge-1', '111111');
      const h2 = svc.hashOtp('challenge-1', '222222');
      expect(h1).not.toBe(h2);
    });
  });

  describe('hashResetToken', () => {
    it('is deterministic for same input', () => {
      const svc = buildService();
      const h1 = svc.hashResetToken('challenge-1', 'secret123');
      const h2 = svc.hashResetToken('challenge-1', 'secret123');
      expect(h1).toBe(h2);
    });

    it('different challengeId produces different hash', () => {
      const svc = buildService();
      const h1 = svc.hashResetToken('challenge-1', 'secret');
      const h2 = svc.hashResetToken('challenge-2', 'secret');
      expect(h1).not.toBe(h2);
    });

    it('different secret produces different hash', () => {
      const svc = buildService();
      const h1 = svc.hashResetToken('challenge-1', 'secret1');
      const h2 = svc.hashResetToken('challenge-1', 'secret2');
      expect(h1).not.toBe(h2);
    });
  });

  describe('safeEqual', () => {
    it('returns true for identical hex strings', () => {
      const svc = buildService();
      expect(svc.safeEqual('aabbccdd', 'aabbccdd')).toBe(true);
    });

    it('returns false for different hex strings', () => {
      const svc = buildService();
      expect(svc.safeEqual('aabbccdd', 'aabbccff')).toBe(false);
    });

    it('returns false for different lengths', () => {
      const svc = buildService();
      expect(svc.safeEqual('aabb', 'aabbccdd')).toBe(false);
    });

    it('returns false for non-hex characters', () => {
      const svc = buildService();
      expect(svc.safeEqual('gghhiijj', 'aabbccdd')).toBe(false);
    });

    it('returns false for non-string inputs', () => {
      const svc = buildService();
      expect(svc.safeEqual(null as never, 'aabbccdd')).toBe(false);
      expect(svc.safeEqual('aabbccdd', null as never)).toBe(false);
      expect(svc.safeEqual(undefined as never, 'aabbccdd')).toBe(false);
    });

    it('returns false for odd-length strings', () => {
      const svc = buildService();
      expect(svc.safeEqual('abc', 'abc')).toBe(false);
    });
  });

  describe('pepper requirement', () => {
    it('throws if pepper is empty', () => {
      const svc = buildService('');
      // Pepper is validated lazily inside hmac(), so call a hash method.
      expect(() => svc.hashEmail('test@example.com')).toThrow('PASSWORD_RECOVERY_PEPPER');
    });
  });
});
