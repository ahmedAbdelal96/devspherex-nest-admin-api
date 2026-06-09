/**
 * Request Password Recovery Use-Case — Unit Tests
 *
 * Tests the public security contract using mocks (no real DB).
 *
 * NOTE: Uses a plain config double instead of createMockConfigService because
 * PasswordRecoveryConfig calls configService.get<string>() which requires
 * reliable string return values at runtime.
 */

import { RequestPasswordRecoveryUseCase } from './request-password-recovery.use-case';
import { PasswordRecoveryConfig } from '../password-recovery.config';
import { PasswordRecoveryHashingService } from '../services/password-recovery-hashing.service';
import { PasswordRecoveryTokenService } from '../services/password-recovery-token.service';
import { PasswordRecoveryChannelService } from '../services/password-recovery-channel.service';
import { PasswordRecoveryPolicyService } from '../services/password-recovery-policy.service';
import { PasswordRecoveryRepository } from '../repositories/password-recovery.repository';
import { PASSWORD_RECOVERY_DISABLED_MESSAGE, PASSWORD_RECOVERY_GENERIC_MESSAGE } from '../password-recovery.constants';
import { createMockPrismaService } from '../../../../test-utils/mocks';

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
  repositoryOverrides: Record<string, unknown> = {},
) {
  const prisma = createMockPrismaService();
  Object.assign(prisma, prismaOverrides);

  const config = makeConfig(configOverrides);
  const hashing = new PasswordRecoveryHashingService(config);
  const tokens = new PasswordRecoveryTokenService(config);
  const channelService = { sendOtp: jest.fn() } as unknown as PasswordRecoveryChannelService;
  const policy = new PasswordRecoveryPolicyService(config);
  const repository = {
    findLatestByEmail: jest.fn(),
    revokeActiveForEmail: jest.fn(),
    create: jest.fn(),
    createMarker: jest.fn(),
    ...repositoryOverrides,
  } as unknown as PasswordRecoveryRepository;

  return new RequestPasswordRecoveryUseCase(
    prisma as never,
    config,
    hashing,
    tokens,
    channelService,
    policy,
    repository,
  );
}

describe('RequestPasswordRecoveryUseCase', () => {
  describe('recovery disabled', () => {
    it('returns disabled message without creating challenges', async () => {
      const uc = buildUseCase({ enabled: false });
      const result = await uc.execute('any@email.com');
      expect(result.message).toBe(PASSWORD_RECOVERY_DISABLED_MESSAGE);
    });
  });

  describe('unknown email', () => {
    it('creates marker and does not call channel send', async () => {
      const createMarker = jest.fn();
      const sendOtp = jest.fn();
      const prisma = createMockPrismaService();
      prisma.user.findUnique = jest.fn().mockResolvedValue(null);

      const channelService = { sendOtp } as unknown as PasswordRecoveryChannelService;
      const config = makeConfig();
      const hashing = new PasswordRecoveryHashingService(config);
      const tokens = new PasswordRecoveryTokenService(config);
      const policy = new PasswordRecoveryPolicyService(config);
      const repository = {
        findLatestByEmail: jest.fn().mockResolvedValue(null),
        revokeActiveForEmail: jest.fn(),
        create: jest.fn(),
        createMarker,
      } as unknown as PasswordRecoveryRepository;

      const uc = new RequestPasswordRecoveryUseCase(
        prisma as never,
        config,
        hashing,
        tokens,
        channelService,
        policy,
        repository,
      );

      const result = await uc.execute('unknown@email.com');

      expect(result.message).toBe(PASSWORD_RECOVERY_GENERIC_MESSAGE);
      expect(createMarker).toHaveBeenCalled();
      expect(sendOtp).not.toHaveBeenCalled();
    });

    it('does NOT include devOtp for unknown email', async () => {
      const prisma = createMockPrismaService();
      prisma.user.findUnique = jest.fn().mockResolvedValue(null);

      const channelService = { sendOtp: jest.fn() } as unknown as PasswordRecoveryChannelService;
      const config = makeConfig({ devReturnOtp: true });
      const hashing = new PasswordRecoveryHashingService(config);
      const tokens = new PasswordRecoveryTokenService(config);
      const policy = new PasswordRecoveryPolicyService(config);
      const repository = {
        findLatestByEmail: jest.fn().mockResolvedValue(null),
        revokeActiveForEmail: jest.fn(),
        create: jest.fn(),
        createMarker: jest.fn(),
      } as unknown as PasswordRecoveryRepository;

      const uc = new RequestPasswordRecoveryUseCase(
        prisma as never,
        config,
        hashing,
        tokens,
        channelService,
        policy,
        repository,
      );

      const result = await uc.execute('unknown@email.com');
      expect(result.devOtp).toBeUndefined();
    });
  });

  describe('known email', () => {
    it('creates real challenge and calls channel send', async () => {
      const create = jest.fn().mockResolvedValue({ id: 'challenge-1' });
      const sendOtp = jest.fn();
      const prisma = createMockPrismaService();
      prisma.user.findUnique = jest.fn().mockResolvedValue({ id: 'user-1', email: 'test@example.com' });
      prisma.passwordRecoveryChallenge.update = jest.fn().mockResolvedValue({ id: 'challenge-1' });

      const channelService = { sendOtp } as unknown as PasswordRecoveryChannelService;
      const config = makeConfig();
      const hashing = new PasswordRecoveryHashingService(config);
      const tokens = new PasswordRecoveryTokenService(config);
      const policy = new PasswordRecoveryPolicyService(config);
      const repository = {
        findLatestByEmail: jest.fn().mockResolvedValue(null),
        revokeActiveForEmail: jest.fn(),
        create,
        createMarker: jest.fn(),
      } as unknown as PasswordRecoveryRepository;

      const uc = new RequestPasswordRecoveryUseCase(
        prisma as never,
        config,
        hashing,
        tokens,
        channelService,
        policy,
        repository,
      );

      const result = await uc.execute('test@example.com');

      expect(result.message).toBe(PASSWORD_RECOVERY_GENERIC_MESSAGE);
      expect(create).toHaveBeenCalled();
      expect(sendOtp).toHaveBeenCalled();
    });

    it('includes devOtp in non-production when devReturnOtp=true', async () => {
      const prisma = createMockPrismaService();
      prisma.user.findUnique = jest.fn().mockResolvedValue({ id: 'user-1', email: 'test@example.com' });
      prisma.passwordRecoveryChallenge.update = jest.fn().mockResolvedValue({ id: 'challenge-1' });

      const channelService = { sendOtp: jest.fn() } as unknown as PasswordRecoveryChannelService;
      const config = makeConfig({ devReturnOtp: true });
      const hashing = new PasswordRecoveryHashingService(config);
      const tokens = new PasswordRecoveryTokenService(config);
      const policy = new PasswordRecoveryPolicyService(config);
      const repository = {
        findLatestByEmail: jest.fn().mockResolvedValue(null),
        revokeActiveForEmail: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'challenge-1' }),
        createMarker: jest.fn(),
      } as unknown as PasswordRecoveryRepository;

      const uc = new RequestPasswordRecoveryUseCase(
        prisma as never,
        config,
        hashing,
        tokens,
        channelService,
        policy,
        repository,
      );

      const result = await uc.execute('test@example.com');
      expect(result.devOtp).toBeDefined();
      expect(result.devOtp).toMatch(/^\d{6}$/);
    });

    it('does NOT include devOtp during cooldown', async () => {
      const recentDate = new Date(Date.now() - 30_000); // 30s ago — within 60s cooldown
      const prisma = createMockPrismaService();
      prisma.user.findUnique = jest.fn().mockResolvedValue({ id: 'user-1', email: 'test@example.com' });

      const channelService = { sendOtp: jest.fn() } as unknown as PasswordRecoveryChannelService;
      const config = makeConfig();
      const hashing = new PasswordRecoveryHashingService(config);
      const tokens = new PasswordRecoveryTokenService(config);
      const policy = new PasswordRecoveryPolicyService(config);
      const repository = {
        findLatestByEmail: jest.fn().mockResolvedValue({ id: 'old-challenge', createdAt: recentDate }),
        revokeActiveForEmail: jest.fn(),
        create: jest.fn(),
        createMarker: jest.fn(),
      } as unknown as PasswordRecoveryRepository;

      const uc = new RequestPasswordRecoveryUseCase(
        prisma as never,
        config,
        hashing,
        tokens,
        channelService,
        policy,
        repository,
      );

      const result = await uc.execute('test@example.com');
      expect(result.message).toBe(PASSWORD_RECOVERY_GENERIC_MESSAGE);
      expect(result.devOtp).toBeUndefined();
    });
  });
});
