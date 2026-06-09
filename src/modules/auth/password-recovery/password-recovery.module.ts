import { Module, Global } from '@nestjs/common';
import { PasswordRecoveryConfig } from './password-recovery.config';
import { PasswordRecoveryHashingService } from './services/password-recovery-hashing.service';
import { PasswordRecoveryTokenService } from './services/password-recovery-token.service';
import { PasswordRecoveryPolicyService } from './services/password-recovery-policy.service';
import { PasswordRecoveryChannelService } from './services/password-recovery-channel.service';
import { PasswordRecoveryRepository } from './repositories/password-recovery.repository';
import { NoopPasswordRecoveryChannel } from './channels/noop-password-recovery.channel';
import { ConsolePasswordRecoveryChannel } from './channels/console-password-recovery.channel';
import { RequestPasswordRecoveryUseCase } from './use-cases/request-password-recovery.use-case';
import { VerifyPasswordRecoveryOtpUseCase } from './use-cases/verify-password-recovery-otp.use-case';
import { ResetPasswordWithTokenUseCase } from './use-cases/reset-password-with-token.use-case';
import { PasswordService } from '../services/password.service';

/**
 * Password Recovery Module
 *
 * Encapsulates the entire password-recovery subsystem:
 *   - Config (env validation, production safety)
 *   - Hashing (email hash, OTP hash, reset-token hash)
 *   - Tokens (OTP generation, reset-token generation, parse helpers)
 *   - Policy (cooldown, TTL, max attempts)
 *   - Channels (Noop, Console; future Email/WhatsApp/SMS plug in here)
 *   - Repository (Prisma access for PasswordRecoveryChallenge)
 *   - Use-cases (request, verify, reset)
 *
 * The module reuses the existing `PasswordService` from the parent auth
 * module for hashing the new password on reset. It is therefore
 * `exports: [PasswordService]`-aware: the provider is provided here as
 * well so this module is self-contained for callers that import only
 * this sub-module.
 */
@Global()
@Module({
  providers: [
    // Config
    PasswordRecoveryConfig,
    // Services
    PasswordRecoveryHashingService,
    PasswordRecoveryTokenService,
    PasswordRecoveryPolicyService,
    PasswordRecoveryChannelService,
    PasswordService,
    // Channels
    NoopPasswordRecoveryChannel,
    ConsolePasswordRecoveryChannel,
    // Repository
    PasswordRecoveryRepository,
    // Use-cases
    RequestPasswordRecoveryUseCase,
    VerifyPasswordRecoveryOtpUseCase,
    ResetPasswordWithTokenUseCase,
  ],
  exports: [
    PasswordRecoveryConfig,
    PasswordRecoveryHashingService,
    PasswordRecoveryTokenService,
    PasswordRecoveryPolicyService,
    PasswordRecoveryChannelService,
    PasswordRecoveryRepository,
    RequestPasswordRecoveryUseCase,
    VerifyPasswordRecoveryOtpUseCase,
    ResetPasswordWithTokenUseCase,
  ],
})
export class PasswordRecoveryModule {}
