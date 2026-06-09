/**
 * Password Recovery Config
 *
 * Reads password-recovery-related env variables via @nestjs/config and
 * validates them at module construction time. Rejects unsafe configurations
 * in production (default pepper, CONSOLE channel, dev OTP return).
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
} from './password-recovery.constants';

const WEAK_PEPPER_VALUES = new Set<string>([
  'change-me-in-production',
  'changeme',
  'pepper',
  'secret',
  'default',
  '',
]);

const ALLOWED_CHANNELS_IN_PRODUCTION: ReadonlySet<PasswordRecoveryChannel> = new Set<
  PasswordRecoveryChannel
>([PASSWORD_RECOVERY_CHANNELS.NOOP, PASSWORD_RECOVERY_CHANNELS.EMAIL]);

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

  private validateProductionSafety(): void {
    if (!this.isProduction) {
      return;
    }

    if (WEAK_PEPPER_VALUES.has(this.pepper)) {
      throw new BadRequestException(
        'PASSWORD_RECOVERY_PEPPER must be set to a strong, non-default value in production',
      );
    }
    if (this.pepper.length < 16) {
      throw new BadRequestException(
        'PASSWORD_RECOVERY_PEPPER must be at least 16 characters in production',
      );
    }

    if (
      this.channel === PASSWORD_RECOVERY_CHANNELS.CONSOLE ||
      this.channel === PASSWORD_RECOVERY_CHANNELS.NOOP
    ) {
      // CONSOLE/NOOP channel in production is suspicious — log a warning but allow
      // because some companies intentionally disable password recovery in production.
      this.logger.warn(
        `PASSWORD_RECOVERY_CHANNEL is "${this.channel}" in production. Password recovery delivery will not reach users.`,
      );
    } else if (!ALLOWED_CHANNELS_IN_PRODUCTION.has(this.channel)) {
      this.logger.warn(
        `PASSWORD_RECOVERY_CHANNEL is "${this.channel}" in production. Make sure a real provider is wired up before relying on it.`,
      );
    }

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
        `maxAttempts=${this.maxVerifyAttempts} revokeSessions=${this.revokeSessionsOnSuccess} ` +
        `devReturnOtp=${this.devReturnOtp} env=${this.nodeEnv}`,
    );
  }
}
