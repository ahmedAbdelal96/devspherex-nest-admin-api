/**
 * Password Recovery Config
 *
 * Reads password-recovery-related env variables via @nestjs/config and
 * validates them at module construction time. Rejects unsafe configurations
 * in production:
 *   - When PASSWORD_RECOVERY_ENABLED=true:
 *     * PASSWORD_RECOVERY_CHANNEL must be implemented AND production-ready
 *       (see `password-recovery-channel-readiness.ts`).
 *     * PASSWORD_RECOVERY_PEPPER must not be a weak default and ≥16 chars.
 *   - Always in production:
 *     * PASSWORD_RECOVERY_DEV_RETURN_OTP must be false.
 *
 * Until a real EMAIL / WHATSAPP / SMS provider is implemented and the
 * readiness table is updated, the only way to run a production deployment
 * is `PASSWORD_RECOVERY_ENABLED=false`.
 *
 * ------------------------------------------------------------------------
 * DI design (Phase 4-R4-R1)
 * ------------------------------------------------------------------------
 * This class MUST NOT inject `PasswordRecoveryChannelService`.
 *
 * Phase 4-R4 originally injected the service to call its readiness
 * predicates. That created a circular dependency:
 *
 *   PasswordRecoveryConfig --> PasswordRecoveryChannelService --> PasswordRecoveryConfig
 *
 * Phase 4-R4-R1 moves the readiness logic to a pure helper file
 * (`./password-recovery-channel-readiness.ts`) that has no DI
 * dependencies. This class calls the pure functions directly.
 * `PasswordRecoveryChannelService` also calls the same pure
 * functions for its public predicates, so the two stay in sync
 * without forming a DI cycle.
 *
 * All env variables are read from the `passwordRecovery` namespace:
 *   PASSWORD_RECOVERY_ENABLED
 *   PASSWORD_RECOVERY_CHANNEL
 *   PASSWORD_RECOVERY_OTP_LENGTH
 *   PASSWORD_RECOVERY_OTP_TTL_SECONDS
 *   PASSWORD_RECOVERY_RESET_TOKEN_TTL_SECONDS
 *   PASSWORD_RECOVERY_RESEND_COOLDOWN_SECONDS
 *   PASSWORD_RECOVERY_MAX_VERIFY_ATTEMPTS
 *   PASSWORD_RECOVERY_REVOKE_SESSIONS_ON_SUCCESS
 *   PASSWORD_RECOVERY_PEPPER
 *   PASSWORD_RECOVERY_DEV_RETURN_OTP
 *   PASSWORD_RECOVERY_MIN_RESPONSE_MS
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PASSWORD_RECOVERY_CHANNELS,
  PasswordRecoveryChannel,
} from './password-recovery.types';
import {
  PASSWORD_RECOVERY_DEFAULT_OTP_LENGTH,
  PASSWORD_RECOVERY_DEFAULT_OTP_TTL_SECONDS,
  PASSWORD_RECOVERY_DEFAULT_RESET_TOKEN_TTL_SECONDS,
  PASSWORD_RECOVERY_DEFAULT_RESEND_COOLDOWN_SECONDS,
  PASSWORD_RECOVERY_DEFAULT_MAX_VERIFY_ATTEMPTS,
  PASSWORD_RECOVERY_DEFAULT_MIN_RESPONSE_MS,
  PASSWORD_RECOVERY_MAX_MIN_RESPONSE_MS,
} from './password-recovery.constants';
import {
  isPasswordRecoveryChannelImplemented,
  isPasswordRecoveryChannelProductionReady,
  getPasswordRecoveryChannelReadiness,
} from './password-recovery-channel-readiness';

const WEAK_PEPPER_VALUES = new Set<string>([
  'change-me-in-production',
  'changeme',
  'pepper',
  'secret',
  'default',
  '',
]);

@Injectable()
export class PasswordRecoveryConfig {
  private readonly logger = new Logger(PasswordRecoveryConfig.name);

  readonly enabled: boolean;
  readonly channel: PasswordRecoveryChannel;
  readonly otpLength: number;
  readonly otpTtlSeconds: number;
  readonly resetTokenTtlSeconds: number;
  readonly resendCooldownSeconds: number;
  readonly maxVerifyAttempts: number;
  readonly revokeSessionsOnSuccess: boolean;
  readonly pepper: string;
  readonly devReturnOtp: boolean;
  readonly minResponseMs: number;
  readonly nodeEnv: string;

  constructor(configService: ConfigService) {
    this.nodeEnv = (
      configService.get<string>('app.env') ||
      process.env.NODE_ENV ||
      'development'
    ).toLowerCase();

    this.enabled = this.parseBoolean(
      configService.get<string>('passwordRecovery.enabled'),
      true,
    );

    this.channel = this.parseChannel(
      configService.get<string>('passwordRecovery.channel'),
    );

    this.otpLength = this.parseIntInRange(
      configService.get<string>('passwordRecovery.otpLength'),
      PASSWORD_RECOVERY_DEFAULT_OTP_LENGTH,
      4,
      10,
      'PASSWORD_RECOVERY_OTP_LENGTH',
    );

    this.otpTtlSeconds = this.parseIntInRange(
      configService.get<string>('passwordRecovery.otpTtlSeconds'),
      PASSWORD_RECOVERY_DEFAULT_OTP_TTL_SECONDS,
      30,
      3600,
      'PASSWORD_RECOVERY_OTP_TTL_SECONDS',
    );

    this.resetTokenTtlSeconds = this.parseIntInRange(
      configService.get<string>('passwordRecovery.resetTokenTtlSeconds'),
      PASSWORD_RECOVERY_DEFAULT_RESET_TOKEN_TTL_SECONDS,
      60,
      3600,
      'PASSWORD_RECOVERY_RESET_TOKEN_TTL_SECONDS',
    );

    this.resendCooldownSeconds = this.parseIntInRange(
      configService.get<string>('passwordRecovery.resendCooldownSeconds'),
      PASSWORD_RECOVERY_DEFAULT_RESEND_COOLDOWN_SECONDS,
      0,
      3600,
      'PASSWORD_RECOVERY_RESEND_COOLDOWN_SECONDS',
    );

    this.maxVerifyAttempts = this.parseIntInRange(
      configService.get<string>('passwordRecovery.maxVerifyAttempts'),
      PASSWORD_RECOVERY_DEFAULT_MAX_VERIFY_ATTEMPTS,
      1,
      20,
      'PASSWORD_RECOVERY_MAX_VERIFY_ATTEMPTS',
    );

    this.revokeSessionsOnSuccess = this.parseBoolean(
      configService.get<string>('passwordRecovery.revokeSessionsOnSuccess'),
      true,
    );

    this.pepper = (
      configService.get<string>('passwordRecovery.pepper') ||
      process.env.PASSWORD_RECOVERY_PEPPER ||
      ''
    ).trim();

    this.devReturnOtp = this.parseBoolean(
      configService.get<string>('passwordRecovery.devReturnOtp'),
      false,
    );

    this.minResponseMs = this.parseIntInRange(
      configService.get<string>('passwordRecovery.minResponseMs'),
      PASSWORD_RECOVERY_DEFAULT_MIN_RESPONSE_MS,
      0,
      PASSWORD_RECOVERY_MAX_MIN_RESPONSE_MS,
      'PASSWORD_RECOVERY_MIN_RESPONSE_MS',
    );

    this.validateProductionSafety();
    this.logSafeSummary();
  }

  /**
   * Returns true if the running environment is production.
   */
  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  private parseBoolean(raw: unknown, fallback: boolean): boolean {
    if (raw === undefined || raw === null || raw === '') {
      return fallback;
    }
    const v = String(raw).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(v)) return true;
    if (['0', 'false', 'no', 'off'].includes(v)) return false;
    return fallback;
  }

  private parseIntInRange(
    raw: unknown,
    fallback: number,
    min: number,
    max: number,
    envName: string,
  ): number {
    if (raw === undefined || raw === null || raw === '') {
      return fallback;
    }
    const parsed = Number.parseInt(String(raw), 10);
    if (Number.isNaN(parsed)) {
      throw new BadRequestException(
        `Invalid value for ${envName}: "${raw}" is not a number`,
      );
    }
    if (parsed < min || parsed > max) {
      throw new BadRequestException(
        `Invalid value for ${envName}: must be between ${min} and ${max}`,
      );
    }
    return parsed;
  }

  private parseChannel(raw: unknown): PasswordRecoveryChannel {
    const value = (raw === undefined || raw === null
      ? 'CONSOLE'
      : String(raw).trim().toUpperCase()) as PasswordRecoveryChannel;

    const validValues = Object.values(PASSWORD_RECOVERY_CHANNELS) as string[];
    if (!validValues.includes(value)) {
      throw new BadRequestException(
        `Invalid PASSWORD_RECOVERY_CHANNEL: "${raw}". Allowed: ${validValues.join(', ')}`,
      );
    }
    return value as PasswordRecoveryChannel;
  }

  /**
   * Production-only safety checks.
   *
   * Phase 4-R4-R1: this method calls pure helper functions from
   * `password-recovery-channel-readiness.ts` rather than injecting
   * `PasswordRecoveryChannelService`. This breaks the original R4
   * DI cycle.
   */
  private validateProductionSafety(): void {
    if (!this.isProduction) {
      return;
    }

    if (this.enabled) {
      // When recovery is enabled in production, the configured channel
      // MUST be production-ready. Readiness is consulted via the pure
      // helper, which is the single source of truth for "is this
      // channel actually implemented as a working provider?".
      const readiness = getPasswordRecoveryChannelReadiness(this.channel);

      if (!isPasswordRecoveryChannelImplemented(this.channel)) {
        throw new BadRequestException(
          `PASSWORD_RECOVERY_CHANNEL=${this.channel} is not implemented in this starter. ` +
            `${readiness.reason}. ` +
            `Set PASSWORD_RECOVERY_ENABLED=false in production or implement a real ${this.channel} provider and mark it production-ready.`,
        );
      }
      if (!isPasswordRecoveryChannelProductionReady(this.channel)) {
        throw new BadRequestException(
          `PASSWORD_RECOVERY_CHANNEL=${this.channel} is implemented but NOT production-ready. ` +
            `${readiness.reason}. ` +
            `Set PASSWORD_RECOVERY_ENABLED=false in production, or implement a real production provider and update the readiness table.`,
        );
      }

      // Weak pepper is rejected only when recovery is actually enabled —
      // if recovery is disabled, the pepper is never used, so we relax.
      if (WEAK_PEPPER_VALUES.has(this.pepper)) {
        throw new BadRequestException(
          'PASSWORD_RECOVERY_PEPPER must be set to a strong, non-default value in production when recovery is enabled',
        );
      }
      if (this.pepper.length < 16) {
        throw new BadRequestException(
          'PASSWORD_RECOVERY_PEPPER must be at least 16 characters in production when recovery is enabled',
        );
      }
    } else {
      // Recovery is disabled in production. We still warn if a weak pepper
      // is set so operators notice it before re-enabling the feature.
      if (WEAK_PEPPER_VALUES.has(this.pepper) || this.pepper.length < 16) {
        this.logger.warn(
          'PASSWORD_RECOVERY_PEPPER is a weak default. It is not validated strictly while PASSWORD_RECOVERY_ENABLED=false, ' +
            'but make sure to set a strong value before re-enabling recovery in production.',
        );
      }
    }

    // devReturnOtp is ALWAYS rejected in production, regardless of enabled.
    if (this.devReturnOtp) {
      throw new BadRequestException(
        'PASSWORD_RECOVERY_DEV_RETURN_OTP must be false in production',
      );
    }
  }

  private logSafeSummary(): void {
    this.logger.log(
      `Password recovery: enabled=${this.enabled} channel=${this.channel} ` +
        `otpLength=${this.otpLength} otpTtl=${this.otpTtlSeconds}s ` +
        `resetTokenTtl=${this.resetTokenTtlSeconds}s cooldown=${this.resendCooldownSeconds}s ` +
        `maxVerifyAttempts=${this.maxVerifyAttempts} revokeSessions=${this.revokeSessionsOnSuccess} ` +
        `devReturnOtp=${this.devReturnOtp} env=${this.nodeEnv}`,
    );
  }
}
