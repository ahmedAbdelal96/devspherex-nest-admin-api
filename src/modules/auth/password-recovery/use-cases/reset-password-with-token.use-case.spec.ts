/**
 * Reset Password With Token Use-Case — Unit Tests
 *
 * Tests rejection of malformed tokens, markers, expired tokens, consumed challenges,
 * and successful reset with transaction semantics.
 *
 * NOTE: Uses a plain config double instead of createMockConfigService because
 * PasswordRecoveryConfig calls configService.get<string>() which requires
 * reliable string return values at runtime.
 */

import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ResetPasswordWithTokenUseCase } from './reset-password-with-token.use-case';
import { PasswordRecoveryConfig } from '../password-recovery.config';
import { PasswordRecoveryHashingService } from '../services/password-recovery-hashing.service';
import { PasswordRecoveryTokenService } from '../services/password-recovery-token.service';
import { PasswordService } from '../../services/password.service';
import { createMockPrismaService } from '../../../../test-utils/mocks';

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
  configOverrides: Partial<PasswordRecoveryConfig> = {},
  prismaOverrides: Record<string, unknown> = {},
) {
  const config = makeConfig(configOverrides);
  const hashing = new PasswordRecoveryHashingService(config);
  const tokens = new PasswordRecoveryTokenService(config);
  const passwordService = { hashPassword: jest.fn().mockResolvedValue('newhash') } as unknown as PasswordService;
  const prisma = createMockPrismaService();
  Object.assign(prisma, prismaOverrides);
  const auditLogService = { log: jest.fn().mockResolvedValue(undefined) } as never;

  return new ResetPasswordWithTokenUseCase(prisma as never, passwordService, config, hashing, tokens, auditLogService);
}

describe('ResetPasswordWithTokenUseCase', () => {
  describe('feature disabled', () => {
    it('throws BadRequestException', async () => {
      // Pass enabled: false in configOverrides (1st arg), not prismaOverrides (2nd arg)
      const uc = buildUseCase({ enabled: false });
      // Token must be well-formed to pass extractChallengeId/challenge-lookup
      // before hitting the config.enabled guard; use a valid challengeId.secret format
      await expect(uc.execute('challenge-id.secret', 'NewPass123!')).rejects.toThrow(BadRequestException);
    });
  });

  describe('malformed reset token', () => {
    it('rejects token with no dot', async () => {
      const uc = buildUseCase();
      await expect(uc.execute('no-dot-here', 'NewPass123!')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects token with only dot', async () => {
      const uc = buildUseCase();
      await expect(uc.execute('.', 'NewPass123!')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects empty string', async () => {
      const uc = buildUseCase();
      await expect(uc.execute('', 'NewPass123!')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('challenge lookup', () => {
    it('rejects when challenge not found', async () => {
      const prisma = createMockPrismaService();
      prisma.passwordRecoveryChallenge.findUnique = jest.fn().mockResolvedValue(null);
      const uc = buildUseCase({}, prisma);
      await expect(uc.execute('challenge-id.secret', 'NewPass123!')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects marker challenge', async () => {
      const prisma = createMockPrismaService();
      prisma.passwordRecoveryChallenge.findUnique = jest.fn().mockResolvedValue({ isMarker: true });
      const uc = buildUseCase({}, prisma);
      await expect(uc.execute('challenge-id.secret', 'NewPass123!')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects revoked challenge', async () => {
      const prisma = createMockPrismaService();
      prisma.passwordRecoveryChallenge.findUnique = jest.fn().mockResolvedValue({
        isMarker: false,
        revokedAt: new Date(),
      });
      const uc = buildUseCase({}, prisma);
      await expect(uc.execute('challenge-id.secret', 'NewPass123!')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects consumed challenge', async () => {
      const prisma = createMockPrismaService();
      prisma.passwordRecoveryChallenge.findUnique = jest.fn().mockResolvedValue({
        isMarker: false,
        revokedAt: null,
        consumedAt: new Date(),
      });
      const uc = buildUseCase({}, prisma);
      await expect(uc.execute('challenge-id.secret', 'NewPass123!')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects challenge without OTP verification', async () => {
      const prisma = createMockPrismaService();
      prisma.passwordRecoveryChallenge.findUnique = jest.fn().mockResolvedValue({
        isMarker: false,
        revokedAt: null,
        consumedAt: null,
        otpVerifiedAt: null,
      });
      const uc = buildUseCase({}, prisma);
      await expect(uc.execute('challenge-id.secret', 'NewPass123!')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects expired reset token', async () => {
      const prisma = createMockPrismaService();
      prisma.passwordRecoveryChallenge.findUnique = jest.fn().mockResolvedValue({
        isMarker: false,
        revokedAt: null,
        consumedAt: null,
        otpVerifiedAt: new Date(),
        resetTokenHash: 'somehash',
        resetTokenExpiresAt: pastDate(60_000),
      });
      const uc = buildUseCase({}, prisma);
      await expect(uc.execute('challenge-id.secret', 'NewPass123!')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects inactive user', async () => {
      const prisma = createMockPrismaService();
      prisma.passwordRecoveryChallenge.findUnique = jest.fn().mockResolvedValue({
        isMarker: false,
        revokedAt: null,
        consumedAt: null,
        otpVerifiedAt: new Date(),
        resetTokenHash: 'somehash',
        resetTokenExpiresAt: futureDate(300_000),
        userId: 'user-1',
      });
      prisma.user.findUnique = jest.fn().mockResolvedValue({ id: 'user-1', status: 'DISABLED' });
      const uc = buildUseCase({}, prisma);
      await expect(uc.execute('challenge-id.secret', 'NewPass123!')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('successful reset', () => {
    it('updates password inside a transaction', async () => {
      const config = makeConfig();
      const hashing = new PasswordRecoveryHashingService(config);
      const tokens = new PasswordRecoveryTokenService(config);

      const challenge = {
        id: 'challenge-1',
        isMarker: false,
        revokedAt: null,
        consumedAt: null,
        otpVerifiedAt: new Date(),
        resetTokenHash: hashing.hashResetToken('challenge-1', 'secret'),
        resetTokenExpiresAt: futureDate(300_000),
        userId: 'user-1',
      };

      const prisma = createMockPrismaService();
      prisma.passwordRecoveryChallenge.findUnique = jest.fn().mockResolvedValue(challenge);
      prisma.user.findUnique = jest.fn().mockResolvedValue({ id: 'user-1', status: 'ACTIVE' });

      const $transaction = jest.fn(async (cb) => {
        const tx = createMockPrismaService();
        tx.passwordRecoveryChallenge.updateMany = jest.fn().mockResolvedValue({ count: 1 });
        tx.user.update = jest.fn().mockResolvedValue({});
        tx.refreshToken.updateMany = jest.fn().mockResolvedValue({ count: 0 });
        return cb(tx);
      });
      prisma.$transaction = $transaction;

      const passwordService = { hashPassword: jest.fn().mockResolvedValue('newhash') };
      const auditLogService = { log: jest.fn().mockResolvedValue(undefined) };

      const uc = new ResetPasswordWithTokenUseCase(
        prisma as never,
        passwordService as never,
        config,
        hashing,
        tokens,
        auditLogService as never,
      );

      const result = await uc.execute('challenge-1.secret', 'NewPass123!');
      expect(result.message).toBeDefined();
      expect($transaction).toHaveBeenCalled();
    });

    it('rejects replay — consumedAt guard blocks double reset', async () => {
      const prisma = createMockPrismaService();
      prisma.passwordRecoveryChallenge.findUnique = jest.fn().mockResolvedValue({
        isMarker: false,
        revokedAt: null,
        consumedAt: new Date(), // already consumed
        otpVerifiedAt: new Date(),
        resetTokenHash: 'somehash',
        resetTokenExpiresAt: futureDate(300_000),
        userId: 'user-1',
      });
      const uc = buildUseCase({}, prisma);
      await expect(uc.execute('challenge-id.secret', 'NewPass123!')).rejects.toThrow(UnauthorizedException);
    });
  });
});
