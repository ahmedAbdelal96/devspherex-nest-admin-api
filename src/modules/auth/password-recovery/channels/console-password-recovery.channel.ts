/**
 * Console Password Recovery Channel
 *
 * Logs the OTP to the server console. Intended for local development only.
 * In production, this channel is selected at config-load time, but the
 * implementation is intentionally a no-op when NODE_ENV === 'production' to
 * prevent accidental OTP leakage.
 *
 * NEVER use this channel in production. Configure an email/WhatsApp/SMS
 * provider instead.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PasswordRecoveryChannelProvider } from './password-recovery-channel.interface';
import { PasswordRecoveryChannelPayload } from '../password-recovery.types';
import { PasswordRecoveryConfig } from '../password-recovery.config';

@Injectable()
export class ConsolePasswordRecoveryChannel implements PasswordRecoveryChannelProvider {
  private readonly logger = new Logger(ConsolePasswordRecoveryChannel.name);

  constructor(private readonly config: PasswordRecoveryConfig) {}

  async sendOtp(payload: PasswordRecoveryChannelPayload): Promise<void> {
    if (this.config.isProduction) {
      this.logger.warn(
        'ConsolePasswordRecoveryChannel invoked in production. Dropping delivery to prevent OTP leakage.',
      );
      return;
    }

    // Intentionally avoid logging the raw "to" email here. Logging the masked
    // destination + purpose keeps dev output useful without leaking PII.
    const maskedTo = this.maskDestination(payload.to);

    this.logger.warn(
      `[DEV ONLY] Password recovery OTP for ${payload.purpose} sent to ${maskedTo}. ` +
        `OTP=${payload.otp} expiresIn=${payload.expiresInSeconds}s`,
    );
  }

  private maskDestination(destination: string): string {
    if (!destination || destination.length === 0) return '***';
    if (destination.includes('@')) {
      const [local, domain] = destination.split('@');
      const maskedLocal =
        local.length <= 2
          ? `${local[0] ?? '*'}*`
          : `${local[0]}${'*'.repeat(Math.max(1, local.length - 2))}${local[local.length - 1]}`;
      return `${maskedLocal}@${domain}`;
    }
    if (destination.length <= 4) {
      return `${destination[0]}***`;
    }
    return `${destination.slice(0, 2)}***${destination.slice(-2)}`;
  }
}
