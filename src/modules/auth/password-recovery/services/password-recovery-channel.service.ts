/**
 * Password Recovery Channel Service
 *
 * Resolves the configured channel at runtime and dispatches OTP delivery.
 * Adding a new provider (Email / WhatsApp / SMS) only requires:
 *   1. Implementing `PasswordRecoveryChannelProvider`.
 *   2. Registering it as a provider in `password-recovery.module.ts`.
 *   3. Adding a `case` for it in `resolveChannel` below.
 *   4. Updating the readiness table in
 *      `./password-recovery-channel-readiness.ts`.
 *
 * No use-case ever imports a specific channel — they only depend on this
 * service, which keeps the use-cases channel-agnostic.
 *
 * ------------------------------------------------------------------------
 * Readiness predicates (Phase 4-R4-R1)
 * ------------------------------------------------------------------------
 * `isChannelImplemented` and `isChannelProductionReady` are public
 * helpers that delegate to the pure readiness registry in
 * `./password-recovery-channel-readiness.ts`. They are kept on this
 * service for callers that already inject it (and to preserve the
 * Phase 4-R4 public API), but the source of truth lives in the
 * pure helper.
 *
 * `PasswordRecoveryConfig` does NOT inject this service for
 * readiness checks. It calls the pure helper directly. This breaks
 * the circular DI dependency that Phase 4-R4 introduced.
 *
 * Phase 4-R4-R1 baseline: NO channel in this starter is
 * production-ready. A real provider must be implemented and the
 * readiness table updated before the channel can return `true`.
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
import {
  isPasswordRecoveryChannelImplemented as helperIsImplemented,
  isPasswordRecoveryChannelProductionReady as helperIsProductionReady,
} from '../password-recovery-channel-readiness';

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
   *
   * Phase 4-R4-R1: delegates to the pure readiness helper. Kept on
   * this service for backward compatibility with Phase 4-R4 callers.
   */
  isChannelImplemented(channel: PasswordRecoveryChannel): boolean {
    return helperIsImplemented(channel);
  }

  /**
   * Returns true when the channel is safe to use in a live deployment
   * that needs to actually deliver OTPs to real users.
   *
   * Phase 4-R4-R1: delegates to the pure readiness helper. The
   * helper is also used directly by `PasswordRecoveryConfig` so
   * there is exactly one source of truth.
   */
  isChannelProductionReady(channel: PasswordRecoveryChannel): boolean {
    return helperIsProductionReady(channel);
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
