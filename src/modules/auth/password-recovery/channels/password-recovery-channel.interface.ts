/**
 * Password Recovery Channel Interface
 *
 * A delivery channel is responsible for sending a one-time password to a user.
 * Channels are swappable: adding Email / WhatsApp / SMS providers later only
 * requires implementing this interface and registering the new class in
 * PasswordRecoveryChannelService.
 *
 * Design rules for all channel implementations:
 *   - Never log OTPs in production.
 *   - Never expose OTPs through the channel response.
 *   - Always treat the destination ("to") as PII — log it carefully.
 *   - Surface failures via thrown errors; the use-case decides what to do.
 */

import { PasswordRecoveryChannelPayload } from '../password-recovery.types';

export interface PasswordRecoveryChannelProvider {
  /**
   * Send the OTP through this channel.
   */
  sendOtp(payload: PasswordRecoveryChannelPayload): Promise<void>;
}
