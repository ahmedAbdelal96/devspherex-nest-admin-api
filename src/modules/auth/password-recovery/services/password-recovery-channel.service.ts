/**
 * Password Recovery Channel Service
 *
 * Resolves the configured channel at runtime and dispatches OTP delivery.
 * Adding a new provider (Email / WhatsApp / SMS) only requires:
 *   1. Implementing PasswordRecoveryChannelProvider.
 *   2. Registering it as a provider here and adding the mapping below.
 *
 * No use-case ever imports a specific channel — they only depend on this
 * service, which keeps the use-cases channel-agnostic.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PasswordRecoveryChannelProvider } from '../channels/password-recovery-channel.interface';
import { NoopPasswordRecoveryChannel } from '../channels/noop-password-recovery.channel';
import { ConsolePasswordRecoveryChannel } from '../channels/console-password-recovery.channel';
import { PasswordRecoveryConfig } from '../password-recovery.config';
import { PasswordRecoveryChannelPayload } from '../password-recovery.types';
import {
  PASSWORD_RECOVERY_CHANNELS,
  PasswordRecoveryChannel,
} from '../password-recovery.types';

@Injectable()
export class PasswordRecoveryChannelService {
  private readonly logger = new Logger(PasswordRecoveryChannelService.name);

  constructor(
    private readonly config: PasswordRecoveryConfig,
    private readonly noopChannel: NoopPasswordRecoveryChannel,
    private readonly consoleChannel: ConsolePasswordRecoveryChannel,
  ) {}

  /**
   * Send an OTP through the configured channel. Falls back to the noop
   * channel on any dispatch error to avoid leaking server errors to the
   * public response (the public response is generic anyway).
   */
  async sendOtp(payload: PasswordRecoveryChannelPayload): Promise<void> {
    const channel = this.resolveChannel(this.config.channel);
    if (!channel) {
      // No provider registered for the configured channel; do not error out
      // the request — just skip delivery. The generic public response will
      // still be returned.
      this.logger.warn(
        `No provider registered for PASSWORD_RECOVERY_CHANNEL=${this.config.channel}. ` +
          `Skipping OTP delivery.`,
      );
      return;
    }

    try {
      await channel.sendOtp(payload);
    } catch (err) {
      this.logger.error(
        `Failed to send OTP via channel=${this.config.channel}: ${(err as Error).message}`,
      );
      // Swallow delivery errors so we never leak OTP infrastructure
      // problems through the public auth response. The generic message
      // is still returned.
    }
  }

  private resolveChannel(
    channel: PasswordRecoveryChannel,
  ): PasswordRecoveryChannelProvider | null {
    switch (channel) {
      case PASSWORD_RECOVERY_CHANNELS.NOOP:
        return this.noopChannel;
      case PASSWORD_RECOVERY_CHANNELS.CONSOLE:
        return this.consoleChannel;
      case PASSWORD_RECOVERY_CHANNELS.EMAIL:
      case PASSWORD_RECOVERY_CHANNELS.WHATSAPP:
      case PASSWORD_RECOVERY_CHANNELS.SMS:
        // Real providers are intentionally not implemented in this phase.
        // When one is added, register it in the constructor and add the case here.
        return null;
      default:
        return null;
    }
  }
}
