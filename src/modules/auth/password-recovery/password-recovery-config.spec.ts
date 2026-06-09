/**
 * Password Recovery Config — Unit Tests
 *
 * Tests production boot rules in PasswordRecoveryConfig.
 * Uses a mock ConfigService — no real database required.
 */

import { BadRequestException } from '@nestjs/common';
import { PasswordRecoveryConfig } from './password-recovery.config';
import { createMockConfigService } from '../../../test-utils/mocks';

const BASE_ENV = {
  'app.env': 'development',
  'passwordRecovery.enabled': 'true',
  'passwordRecovery.channel': 'CONSOLE',
  'passwordRecovery.otpLength': '6',
  'passwordRecovery.otpTtlSeconds': '300',
  'passwordRecovery.resetTokenTtlSeconds': '600',
  'passwordRecovery.resendCooldownSeconds': '60',
  'passwordRecovery.maxVerifyAttempts': '5',
  'passwordRecovery.revokeSessionsOnSuccess': 'true',
  'passwordRecovery.pepper': 'super-secret-pepper-that-is-long-enough-32chars',
  'passwordRecovery.devReturnOtp': 'false',
  'passwordRecovery.minResponseMs': '0',
};

function buildConfig(overrides: Record<string, unknown> = {}): PasswordRecoveryConfig {
  return new PasswordRecoveryConfig(createMockConfigService({ ...BASE_ENV, ...overrides }));
}

describe('PasswordRecoveryConfig', () => {
  describe('parseBoolean fallback', () => {
    it('defaults to true when env is absent', () => {
      const config = buildConfig({ 'passwordRecovery.enabled': undefined });
      expect(config.enabled).toBe(true);
    });

    it('parses true-like values', () => {
      const config = buildConfig({ 'passwordRecovery.enabled': 'true' });
      expect(config.enabled).toBe(true);
    });

    it('parses false-like values', () => {
      const config = buildConfig({ 'passwordRecovery.enabled': 'false' });
      expect(config.enabled).toBe(false);
    });
  });

  describe('otpLength', () => {
    it('reads PASSWORD_RECOVERY_OTP_LENGTH', () => {
      const config = buildConfig({ 'passwordRecovery.otpLength': '8' });
      expect(config.otpLength).toBe(8);
    });

    it('enforces min=4', () => {
      expect(() => buildConfig({ 'passwordRecovery.otpLength': '3' })).toThrow(BadRequestException);
    });

    it('enforces max=10', () => {
      expect(() => buildConfig({ 'passwordRecovery.otpLength': '11' })).toThrow(BadRequestException);
    });
  });

  describe('maxVerifyAttempts', () => {
    it('reads PASSWORD_RECOVERY_MAX_VERIFY_ATTEMPTS', () => {
      const config = buildConfig({ 'passwordRecovery.maxVerifyAttempts': '10' });
      expect(config.maxVerifyAttempts).toBe(10);
    });
  });

  describe('minResponseMs', () => {
    it('reads PASSWORD_RECOVERY_MIN_RESPONSE_MS', () => {
      const config = buildConfig({ 'passwordRecovery.minResponseMs': '500' });
      expect(config.minResponseMs).toBe(500);
    });

    it('enforces max=5000', () => {
      expect(() => buildConfig({ 'passwordRecovery.minResponseMs': '6000' })).toThrow(BadRequestException);
    });
  });

  describe('isProduction', () => {
    it('returns true when app.env=production', () => {
      const config = buildConfig({ 'app.env': 'production', 'passwordRecovery.enabled': 'false' });
      expect(config.isProduction).toBe(true);
    });

    it('returns false when app.env=development', () => {
      const config = buildConfig({ 'app.env': 'development' });
      expect(config.isProduction).toBe(false);
    });
  });

  describe('production boot rules — recovery enabled', () => {
    const productionBase = {
      'app.env': 'production',
      'passwordRecovery.enabled': 'true',
      'passwordRecovery.channel': 'CONSOLE',
      'passwordRecovery.pepper': 'super-secret-pepper-that-is-long-enough-32chars',
      'passwordRecovery.devReturnOtp': 'false',
    };

    it('production + enabled + CONSOLE => throws (not production-ready)', () => {
      expect(() => buildConfig(productionBase)).toThrow(BadRequestException);
    });

    it('production + enabled + NOOP => throws (not production-ready)', () => {
      expect(() =>
        buildConfig({ ...productionBase, 'passwordRecovery.channel': 'NOOP' }),
      ).toThrow(BadRequestException);
    });

    it('production + enabled + EMAIL => throws (not implemented)', () => {
      expect(() =>
        buildConfig({ ...productionBase, 'passwordRecovery.channel': 'EMAIL' }),
      ).toThrow(BadRequestException);
    });

    it('production + enabled + weak pepper => throws', () => {
      expect(() =>
        buildConfig({ ...productionBase, 'passwordRecovery.pepper': 'change-me-in-production' }),
      ).toThrow(BadRequestException);
    });

    it('production + enabled + short pepper => throws', () => {
      expect(() =>
        buildConfig({ ...productionBase, 'passwordRecovery.pepper': 'short' }),
      ).toThrow(BadRequestException);
    });
  });

  describe('production boot rules — recovery disabled', () => {
    const productionDisabled = {
      'app.env': 'production',
      'passwordRecovery.enabled': 'false',
      'passwordRecovery.channel': 'CONSOLE',
      'passwordRecovery.pepper': 'change-me-in-production',
      'passwordRecovery.devReturnOtp': 'false',
    };

    it('production + disabled + CONSOLE => allowed (weak pepper only warns)', () => {
      // Should not throw — recovery is disabled so pepper is not enforced strictly
      const config = buildConfig(productionDisabled);
      expect(config.enabled).toBe(false);
      expect(config.channel).toBe('CONSOLE');
    });
  });

  describe('production boot rules — devReturnOtp', () => {
    it('production + devReturnOtp=true => throws regardless of recovery state', () => {
      expect(() =>
        buildConfig({
          'app.env': 'production',
          'passwordRecovery.enabled': 'false',
          'passwordRecovery.devReturnOtp': 'true',
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('development environment', () => {
    it('development + enabled + CONSOLE => allowed', () => {
      const config = buildConfig({
        'app.env': 'development',
        'passwordRecovery.enabled': 'true',
        'passwordRecovery.channel': 'CONSOLE',
        'passwordRecovery.pepper': 'any-pepper-value',
        'passwordRecovery.devReturnOtp': 'false',
      });
      expect(config.enabled).toBe(true);
      expect(config.channel).toBe('CONSOLE');
 });

    it('development + devReturnOtp=true => allowed (only throws in production)', () => {
      const config = buildConfig({
        'app.env': 'development',
        'passwordRecovery.enabled': 'true',
        'passwordRecovery.devReturnOtp': 'true',
        'passwordRecovery.pepper': 'any-pepper-value',
      });
      expect(config.devReturnOtp).toBe(true);
    });
  });

  describe('channel parsing', () => {
    it('uppercases channel value', () => {
      const config = buildConfig({ 'passwordRecovery.channel': 'console' });
      expect(config.channel).toBe('CONSOLE');
    });

    it('throws on invalid channel', () => {
      expect(() => buildConfig({ 'passwordRecovery.channel': 'SNAIL' })).toThrow(BadRequestException);
    });
  });
});
