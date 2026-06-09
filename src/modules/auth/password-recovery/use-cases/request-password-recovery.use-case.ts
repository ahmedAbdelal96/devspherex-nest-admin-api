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
 *   - The dev-only `devOtp` field is included in the response ONLY when
 *     `PASSWORD_RECOVERY_DEV_RETURN_OTP=true` AND the environment is not
 *     production AND a real OTP was actually generated (i.e. a known
 *     user triggered the flow and we were not in cooldown). It is never
 *     present in production, never present for unknown-email markers,
 *     and never present when the cooldown blocked a new OTP.
 *   - Optional timing floor:
 *     `PASSWORD_RECOVERY_MIN_RESPONSE_MS` (default 0 = disabled) is
 *     applied on every code path of this use-case. The handler records
 *     the start time and sleeps for the remaining duration before
 *     returning. This narrows the observable timing gap between the
 *     known-email and unknown-email branches. The default is 0 so
 *     that operators opt-in only when they have measured a need.
 */

import { Injectable, Logger } from '@nestjs/common';
import { setTimeout as delay } from 'timers/promises';
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

/**
 * Public response shape returned by this use-case.
 *
 * The `devOtp` field is opt-in and only present in non-production
 * environments when:
 *   - `PASSWORD_RECOVERY_DEV_RETURN_OTP=true`, AND
 *   - a real challenge was actually created for a known email
 *     (i.e. cooldown did not block the request, and the email maps
 *     to a real user).
 */
export interface RequestPasswordRecoveryResult {
  message: string;
  devOtp?: string;
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
  ): Promise<RequestPasswordRecoveryResult> {
    const startedAt = Date.now();
    try {
      return await this.run(rawEmail, context, startedAt);
    } finally {
      await this.applyMinResponseFloor(startedAt);
    }
  }

  private async run(
    rawEmail: string,
    context: RequestPasswordRecoveryContext,
    _startedAt: number,
  ): Promise<RequestPasswordRecoveryResult> {
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
      // `devOtp` is intentionally NOT included here: no real OTP was
      // generated, and exposing it would defeat the cooldown protection
      // against brute-force attempts.
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
      // `devOtp` is intentionally NOT included for unknown emails: no
      // real OTP was generated.
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

    const response: RequestPasswordRecoveryResult = {
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

  /**
   * Apply the optional minimum-response-time floor.
   *
   * This is best-effort: a `setTimeout` is not a hard real-time
   * guarantee, but it does narrow the observable timing gap between
   * the known-email and unknown-email branches of this use-case.
   *
   * The floor is applied to EVERY code path (disabled, cooldown,
   * unknown marker, known email, channel failure) so callers cannot
   * infer which branch ran from the response time alone.
   */
  private async applyMinResponseFloor(startedAt: number): Promise<void> {
    const minMs = this.config.minResponseMs;
    if (minMs <= 0) return;
    const elapsed = Date.now() - startedAt;
    if (elapsed >= minMs) return;
    const remaining = minMs - elapsed;
    // `timers/promises` gives us a typed, lint-friendly `setTimeout`
    // that returns a Promise. It does not block the event loop in a
    // way that prevents other concurrent work from being scheduled.
    await delay(remaining);
  }
}
