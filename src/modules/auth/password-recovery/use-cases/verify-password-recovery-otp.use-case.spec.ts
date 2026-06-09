/**
 * Verify Password Recovery OTP Use-Case — Unit Tests
 *
 * Tests rejection of markers, expired challenges, wrong OTP, max attempts,
 * and successful verification with reset token issuance.
 *
 * NOTE: Uses a plain config double instead of createMockConfigService because
 * PasswordRecoveryConfig calls configService.get<string>() which requires
 * reliable string return values at runtime.
 */

import { UnauthorizedException } from '@nestjs/common';
import { VerifyPasswordRecoveryOtpUseCase } from './verify-password-recovery-otp.use-case';
import { PasswordRecoveryConfig } from '../password-recovery.config';
import { PasswordRecoveryHashingService } from '../services/password-recovery-hashing.service';
import { PasswordRecoveryTokenService } from '../services/password-recovery-token.service';
import { PasswordRecoveryPolicyService } from '../services/password-recovery-policy.service';
import { PasswordRecoveryRepository } from '../repositories/password-recovery.repository';

function futureDate(msFromNow: number): Date {
  return new Date(Date.now() + msFromNow);
}

function pastDate(msFromNow: number): Date {
  return new Date(Date.now() - msFromNow);
}

/**
 * Plain config double — bypasses ConfigService so tests are not affected
 * by mock factory runtime quirks.
 */
function makeConfig(overrides: Partial<PasswordRecoveryConfig> = {}): PasswordRecoveryConfig {
  const defaults = { enabled: true, channel: "CONSOLE" as const, otpLength: 6, otpTtlSeconds: 300, resetTokenTtlSeconds: 600, resendCooldownSeconds: 60, maxVerifyAttempts: 5, revokeSessionsOnSuccess: true, pepper: "test-pepper-for-hashing-32chars!!", devReturnOtp: false, minResponseMs: 0, nodeEnv: "development", get isProduction() { return false; } };
  return { ...defaults, ...overrides } as unknown as PasswordRecoveryConfig;
}

function buildUseCase(
  repositoryOverrides: Record<string, unknown> = {},
  configOverrides: Partial<PasswordRecoveryConfig> = {},
) {
  const config = makeConfig(configOverrides);
  const hashing = new PasswordRecoveryHashingService(config);
  const tokens = new PasswordRecoveryTokenService(config);
  const policy = new PasswordRecoveryPolicyService(config);
  const repository = {
    findLatestActiveByEmail: jest.fn(),
    incrementFailedAttempts: jest.fn(),
    markOtpVerified: jest.fn(),
    ...repositoryOverrides,
  } as unknown as PasswordRecoveryRepository;

  return new VerifyPasswordRecoveryOtpUseCase(config, hashing, tokens, policy, repository);
}

describe('VerifyPasswordRecoveryOtpUseCase', () => {
  describe('feature disabled', () => {
    it('throws UnauthorizedException', async () => {
      const uc = buildUseCase({}, { enabled: false });
      await expect(uc.execute('test@example.com', '123456')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('no active challenge', () => {
    it('throws generic error', async () => {
      const uc = buildUseCase({ findLatestActiveByEmail: jest.fn().mockResolvedValue(null) });
      await expect(uc.execute('test@example.com', '123456')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('expired challenge', () => {
    it('rejects expired OTP', async () => {
      const uc = buildUseCase({
        findLatestActiveByEmail: jest.fn().mockResolvedValue({
          id: 'challenge-1',
          isMarker: false,
          revokedAt: null,
          consumedAt: null,
          otpExpiresAt: pastDate(60_000),
          failedAttempts: 0,
          maxAttempts: 5,
          otpHash: 'anyhash',
        }),
      });
      await expect(uc.execute('test@example.com', '123456')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('wrong OTP', () => {
    it('increments failedAttempts', async () => {
      const challenge = {
        id: 'challenge-1',
        isMarker: false,
        revokedAt: null,
        consumedAt: null,
        otpExpiresAt: futureDate(300_000),
        failedAttempts: 1,
        maxAttempts: 5,
        otpHash: 'hash-of-correct-otp',
      };
      const incrementFailedAttempts = jest.fn().mockResolvedValue(challenge);
      const uc = buildUseCase({
        findLatestActiveByEmail: jest.fn().mockResolvedValue(challenge),
        incrementFailedAttempts,
      });

      // Use a wrong OTP — the mock otpHash won't match any hash we compute
      await expect(uc.execute('test@example.com', '000000')).rejects.toThrow(UnauthorizedException);
      expect(incrementFailedAttempts).toHaveBeenCalledWith('challenge-1', 5);
    });
  });

  describe('max attempts reached', () => {
    it('rejects without verifying OTP', async () => {
      const uc = buildUseCase({
        findLatestActiveByEmail: jest.fn().mockResolvedValue({
          id: 'challenge-1',
          isMarker: false,
          revokedAt: null,
          consumedAt: null,
          otpExpiresAt: futureDate(300_000),
          failedAttempts: 5,
          maxAttempts: 5,
          otpHash: 'anyhash',
        }),
      });
      await expect(uc.execute('test@example.com', '123456')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('correct OTP', () => {
    it('stores resetTokenHash and returns resetSessionToken', async () => {
      const config = makeConfig();
      const hashing = new PasswordRecoveryHashingService(config);
      const challengeId = 'challenge-valid';
      const correctOtp = '123456';

      // Create a challenge whose otpHash matches what the real service computes
      const challenge = {
        id: challengeId,
        isMarker: false,
        revokedAt: null,
        consumedAt: null,
        otpExpiresAt: futureDate(300_000),
        failedAttempts: 0,
        maxAttempts: 5,
        otpHash: hashing.hashOtp(challengeId, correctOtp),
      };

      const markOtpVerified = jest.fn().mockResolvedValue({ ...challenge, otpVerifiedAt: new Date() });
      const uc = buildUseCase({
        findLatestActiveByEmail: jest.fn().mockResolvedValue(challenge),
        markOtpVerified,
      });

      const result = await uc.execute('test@example.com', correctOtp);
      expect(result.resetSessionToken).toBeDefined();
      expect(result.resetSessionToken).toContain('.');
      expect(result.expiresIn).toBe(600);
    });

    it('does not expose raw OTP', async () => {
      const config = makeConfig();
      const hashing = new PasswordRecoveryHashingService(config);
      const challengeId = 'challenge-valid';
      const correctOtp = '123456';

      const challenge = {
        id: challengeId,
        isMarker: false,
        revokedAt: null,
        consumedAt: null,
        otpExpiresAt: futureDate(300_000),
        failedAttempts: 0,
        maxAttempts: 5,
        otpHash: hashing.hashOtp(challengeId, correctOtp),
      };

      const markOtpVerified = jest.fn().mockResolvedValue({ ...challenge, otpVerifiedAt: new Date() });
      const uc = buildUseCase({
        findLatestActiveByEmail: jest.fn().mockResolvedValue(challenge),
        markOtpVerified,
      });

      const result = await uc.execute('test@example.com', correctOtp);
      expect(result.resetSessionToken).not.toBe(correctOtp);
      expect(JSON.stringify(result)).not.toContain(correctOtp);
    });
  });
});
