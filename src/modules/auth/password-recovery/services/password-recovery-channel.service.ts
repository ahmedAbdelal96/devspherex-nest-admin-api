/**
 * Password Recovery Channel Service
 *
 * Resolves the configured channel at runtime and dispatches OTP delivery.
 * Adding a new provider (Email / WhatsApp / SMS) only requires:
 *   1. Implementing PasswordRecoveryChannelProvider.
 *   2. Registering it as a provider here and adding the mapping below.
 *   3. Updating the readiness tables (`isChannelImplemented` /
 *      `isChannelProductionReady`) below.
 *
 * No use-case ever imports a specific channel — they only depend on this
 * service, which keeps the use-cases channel-agnostic.
 *
 * Phase 4-R4 — Provider Readiness Metadata
 * -----------------------------------------
 * The service now exposes two readiness predicates:
 *
 *   - `isChannelImplemented(channel)` — does this channel have a real
 *     `PasswordRecoveryChannelProvider` registered? (CONSOLE and NOOP are
 *     implemented; EMAIL/WHATSAPP/SMS are not in this starter.)
 *
 *   - `isChannelProductionReady(channel)` — is this channel safe to use
 *     in a live deployment that is actually expected to deliver OTPs to
 *     real users? (No channel in this starter is production-ready, because
 *     no real vendor integration is implemented. CONSOLE writes to the
 *     server log only, NOOP discards, and EMAIL/WHATSAPP/SMS have no
 *     provider.)
 *
 * The boot guard in `PasswordRecoveryConfig` uses
 * `isChannelProductionReady` to refuse to start a production deployment
 * that has `PASSWORD_RECOVERY_ENABLED=true` without a real provider. This
 * is the R4 fix for the previous footgun where EMAIL/WHATSAPP/SMS could
 * be configured in production and `resolveChannel` would silently
 * return `null`, dropping the OTP.
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
      // No provider registered for the configured channel. We log a
      // warning so operators can see this in non-production, but we do
      // NOT raise the error into the public response.
      //
      // The boot guard in `PasswordRecoveryConfig` already refused to
      // start the app in production with a non-implemented channel, so
      // reaching this branch in production is impossible. The warning
      // is for non-production environments that want to test the flow
      // without a real provider.
      this.logger.warn(
        `No provider registered for PASSWORD_RECOVERY_CHANNEL=${this.config.channel}. ` +
          `OTP delivery is skipped. This is only acceptable in non-production environments.`,
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

  /**
   * Returns true when the channel has a registered
   * `PasswordRecoveryChannelProvider` in this build.
   */
  isChannelImplemented(channel: PasswordRecoveryChannel): boolean {
    switch (channel) {
      case PASSWORD_RECOVERY_CHANNELS.NOOP:
      case PASSWORD_RECOVERY_CHANNELS.CONSOLE:
        return true;
      case PASSWORD_RECOVERY_CHANNELS.EMAIL:
      case PASSWORD_RECOVERY_CHANNELS.WHATSAPP:
      case PASSWORD_RECOVERY_CHANNELS.SMS:
      default:
        return false;
    }
  }

  /**
   * Returns true when the channel is safe to use in a live deployment
   * that needs to actually deliver OTPs to real users.
   *
   * Phase 4-R4 baseline: NO channel in this starter is production-ready.
   * A real provider must be implemented (and this method updated) before
   * the channel can return `true`.
   */
  isChannelProductionReady(_channel: PasswordRecoveryChannel): boolean {
    // No vendor is wired up in this starter. Update this method when
    // a real provider is added — e.g., return true for EMAIL once
    // a SMTP / SES channel is implemented and registered.
    return false;
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
        // Real providers are intentionally not implemented in this
        // starter. The boot guard in PasswordRecoveryConfig refuses to
        // start the app in production with a non-production-ready
        // channel. In non-production this still returns null, but
        // sendOtp() logs a clear warning and skips delivery.
        return null;
      default:
        return null;
    }
  }
}
