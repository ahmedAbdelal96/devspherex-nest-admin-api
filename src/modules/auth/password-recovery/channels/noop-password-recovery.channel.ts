/**
 * Noop Password Recovery Channel
 *
 * Does nothing. Used when password recovery is disabled or when the operator
 * intentionally wants to drop the delivery (e.g., the company has its own
 * external flow).
 *
 * Production-safe: no logging, no PII handling, no side effects.
 */

import { Injectable } from '@nestjs/common';
import { PasswordRecoveryChannelProvider } from './password-recovery-channel.interface';
import { PasswordRecoveryChannelPayload } from '../password-recovery.types';

@Injectable()
export class NoopPasswordRecoveryChannel implements PasswordRecoveryChannelProvider {
  async sendOtp(_payload: PasswordRecoveryChannelPayload): Promise<void> {
    // intentionally empty
  }
}
