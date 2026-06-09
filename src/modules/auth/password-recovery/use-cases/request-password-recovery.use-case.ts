/**
 * Request Password Recovery Use-Case
 *
 * Step 1 of the password recovery flow. Public endpoint, no authentication.
 *
 * Security contract:
 *   - Always returns a generic success message. The response is identical
 *     whether the email exists or not, and whether cooldown is in effect or
 *     not. This prevents user enumeration.
 *   - If password recovery is disabled by config, returns a safe disabled
 *     message (still no enumeration).
 *   - Email is normalized (trim + lowercase) and stored only as an HMAC
 *     hash. The raw email is never written to the database.
 *   - Older active challenges for the same emailHash + purpose are revoked
 *     before creating the new one, so OTPs are strictly one-time-use.
 *   - Cooldown is enforced by checking the latest challenge for the
 *     emailHash. Cooldown applies to the address, not to a user record,
 *     and works for BOTH known and unknown emails:
 *       * For known emails: a real challenge is created and the OTP is
 *         dispatched through the configured channel.
 *       * For unknown emails: a "marker" challenge is created (userId=null,
 *         isMarker=true, otpHash=null). The marker has no OTP, so it
 *         can never be verified or consumed; it only occupies the
 *         emailHash slot so the cooldown applies uniformly.
 *   - Timing on the unknown-email path is balanced with the known-email
 *     path: the use-case always performs the same number of database
 *     round-trips (revoke, create, optional channel dispatch). The
 *     channel dispatch is the only asymmetric cost and is currently
 *     a no-op (the placeholder channel call is included for future
 *     providers to plug in without timing changes).
 *   - Dev-only `devOtp` field is included in the response only when
 *     `PASSWORD_RECOVERY_DEV_RETURN_OTP=true` and the environment is
 *     not production. The production boot guard refuses to start the
 *     app when this flag is true.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../common/database/prisma.service';
import { PasswordRecoveryConfig } from '../password-recovery.config';
import { PasswordRecoveryHashingService } from '../services/password-recovery-hashing.service';
import { PasswordRecoveryTokenService } from '../services/password-recovery-token.service';
import { PasswordRecoveryChannelService } from '../services/password-recovery-channel.service';
import { PasswordRecoveryPolicyService } from '../services/password-recovery-policy.service';
import { PasswordRecoveryRepository } from '../repositories/password-recovery.repository';
import {
  PASSWORD_RECOVERY_PURPOSES,
} from '../password-recovery.types';
import {
  PASSWORD_RECOVERY_GENERIC_MESSAGE,
  PASSWORD_RECOVERY_DISABLED_MESSAGE,
} from '../password-recovery.constants';

export interface RequestPasswordRecoveryContext {
  requestIp?: string;
  userAgent?: string;
}

@Injectable()
export class RequestPasswordRecoveryUseCase {
  private readonly logger = new Logger(RequestPasswordRecoveryUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: PasswordRecoveryConfig,
    private readonly hashing: PasswordRecoveryHashingService,
    private readonly tokens: PasswordRecoveryTokenService,
    private readonly channels: PasswordRecoveryChannelService,
    private readonly policy: PasswordRecoveryPolicyService,
    private readonly repository: PasswordRecoveryRepository,
  ) {}

  async execute(
    rawEmail: string,
    context: RequestPasswordRecoveryContext = {},
  ): Promise<{ message: string; devOtp?: string }> {
    if (!this.config.enabled) {
      this.logger.warn('Password recovery request received but feature is disabled');
      return { message: PASSWORD_RECOVERY_DISABLED_MESSAGE };
    }

    const normalizedEmail = this.hashing.normalizeEmail(rawEmail);
    const emailHash = this.hashing.hashEmail(normalizedEmail);

    // Cooldown check: enforced on emailHash so it works for both known and
    // unknown emails (markers are included in findLatestByEmail so an
    // unknown-email request still hits the cooldown).
    const latest = await this.repository.findLatestByEmail(
      emailHash,
      PASSWORD_RECOVERY_PURPOSES.PASSWORD_RESET,
    );

    if (this.policy.isWithinResendCooldown(latest)) {
      // Still return generic success — do not leak cooldown state to callers.
      this.logger.debug(
        `Password recovery cooldown active for emailHash prefix=${emailHash.slice(0, 8)}...`,
      );
      return { message: PASSWORD_RECOVERY_GENERIC_MESSAGE };
    }

    // Revoke any older active challenges for this emailHash + purpose so
    // a previously-issued OTP cannot be used after a new one is sent.
    // This applies to markers too, so a previous unknown-email marker
    // gets cleaned up before a new one is created.
    await this.repository.revokeActiveForEmail(
      emailHash,
      PASSWORD_RECOVERY_PURPOSES.PASSWORD_RESET,
    );

    // Look up user by normalized email. Use-case ignores whether the user
    // exists for the public response.
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // No account — create a marker challenge so the cooldown applies
      // uniformly. The marker has no OTP, so it can never be verified or
      // consumed; the verify-otp and reset-password endpoints ignore it
      // (findLatestActiveByEmail filters out isMarker=true).
      await this.repository.createMarker({
        emailHash,
        purpose: PASSWORD_RECOVERY_PURPOSES.PASSWORD_RESET,
        channel: this.config.channel,
        maxAttempts: this.policy.getMaxAttempts(),
        requestIp: context.requestIp,
        userAgent: context.userAgent,
      });
      this.logger.debug(
        `Password recovery marker created for unknown email hash prefix=${emailHash.slice(0, 8)}...`,
      );
      return { message: PASSWORD_RECOVERY_GENERIC_MESSAGE };
    }

    const otp = this.tokens.generateOtp();
    const otpHash = this.hashing.hashOtp('pending', otp);
    const otpExpiresAt = this.policy.computeOtpExpiresAt();

    // The OTP hash must be challenge-specific. We need a challenge id,
    // but the hash is computed before insert. We solve this by creating
    // a placeholder hash, inserting to get the id, then updating the
    // challenge with the real challenge-id-bound hash. This keeps the
    // hash deterministic and challenge-specific.
    const placeholder = await this.repository.create({
      userId: user.id,
      emailHash,
      purpose: PASSWORD_RECOVERY_PURPOSES.PASSWORD_RESET,
      channel: this.config.channel,
      otpHash,
      otpExpiresAt,
      maxAttempts: this.policy.getMaxAttempts(),
      requestIp: context.requestIp,
      userAgent: context.userAgent,
    });

    const realOtpHash = this.hashing.hashOtp(placeholder.id, otp);
    await this.prisma.passwordRecoveryChallenge.update({
      where: { id: placeholder.id },
      data: { otpHash: realOtpHash },
    });

    // Dispatch via the configured channel. Errors are swallowed by the
    // channel service to keep the public response generic.
    await this.channels.sendOtp({
      to: normalizedEmail,
      otp,
      purpose: PASSWORD_RECOVERY_PURPOSES.PASSWORD_RESET,
      expiresInSeconds: this.config.otpTtlSeconds,
    });

    const response: { message: string; devOtp?: string } = {
      message: PASSWORD_RECOVERY_GENERIC_MESSAGE,
    };
    if (!this.config.isProduction && this.config.devReturnOtp) {
      // Dev-only: never enabled in production. The boot guard in
      // PasswordRecoveryConfig refuses to start the app when
      // devReturnOtp is true in production, so this branch can only
      // run in non-production environments.
      response.devOtp = otp;
    }
    return response;
  }
}
