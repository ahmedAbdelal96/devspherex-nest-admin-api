/**
 * Reset Password With Token Use-Case
 *
 * Step 3 of the password recovery flow. Public endpoint, no authentication.
 *
 * Security contract:
 *   - Accepts a resetSessionToken (`<challengeId>.<secret>`).
 *   - The challenge must exist, not be revoked, not be consumed, not be
 *     a marker, must have been OTP-verified, and the reset session token
 *     must not be expired.
 *   - The hash of the token is verified in constant time.
 *   - **All writes happen inside a single Prisma interactive transaction.**
 *     If any step fails, nothing is persisted, and the reset session
 *     token is NOT marked as consumed. This prevents the previous bug
 *     where `markConsumed()` succeeded but the password / tokenVersion
 *     updates could fail in a later transaction, leaving the user stuck
 *     with a consumed-but-unapplied token.
 *
 *   Inside the single transaction:
 *     1. Conditionally mark the challenge as consumed (one-time-use guard).
 *        If the conditional update affects 0 rows, abort with the generic
 *        error — the challenge was already consumed, revoked, expired, or
 *        is a marker.
 *     2. Update the user passwordHash.
 *3. If PASSWORD_RECOVERY_REVOKE_SESSIONS_ON_SUCCESS=true:
 *        a. Revoke all active refresh tokens for the user.
 *        b. Increment user.tokenVersion.
 *     4. Revoke any other active password-recovery challenges for the
 *        same user, so the user cannot have two parallel reset windows.
 *
 *   Marker challenges are filtered out at every read site, so they
 *   can never reach the reset endpoint.
 */

import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../../common/database/prisma.service';
import { PasswordService } from '../../services/password.service';
import { PasswordRecoveryConfig } from '../password-recovery.config';
import { PasswordRecoveryHashingService } from '../services/password-recovery-hashing.service';
import { PasswordRecoveryTokenService } from '../services/password-recovery-token.service';
import { PASSWORD_RECOVERY_PURPOSES } from '../password-recovery.types';
import { PASSWORD_RECOVERY_RESET_SUCCESS_MESSAGE } from '../password-recovery.constants';
import { AuditLogService } from '../../../audit-logs/services/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '../../../audit-logs/constants';

const GENERIC_RESET_ERROR = 'Invalid or expired reset token.';

@Injectable()
export class ResetPasswordWithTokenUseCase {
  private readonly logger = new Logger(ResetPasswordWithTokenUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly config: PasswordRecoveryConfig,
    private readonly hashing: PasswordRecoveryHashingService,
    private readonly tokens: PasswordRecoveryTokenService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(
    resetSessionToken: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    if (!this.config.enabled) {
      throw new BadRequestException('Password recovery is not available');
    }

    const challengeId = this.tokens.extractChallengeId(resetSessionToken);
    const secret = this.tokens.extractSecret(resetSessionToken);
    if (!challengeId || !secret) {
      throw new UnauthorizedException(GENERIC_RESET_ERROR);
    }

    // All reads happen before the transaction. We do not read inside the
    // transaction because the read does not need to be part of the atomic
    // group; the conditional update inside the transaction is what
    // guarantees atomicity.
    const challenge = await this.prisma.passwordRecoveryChallenge.findUnique({
      where: { id: challengeId },
    });
    if (!challenge) {
      throw new UnauthorizedException(GENERIC_RESET_ERROR);
    }
    if (challenge.isMarker) {
      // Marker challenges are placeholders only — they have no OTP and
      // cannot have produced a reset session token. Treat as invalid.
      throw new UnauthorizedException(GENERIC_RESET_ERROR);
    }
    if (challenge.revokedAt) {
      throw new UnauthorizedException(GENERIC_RESET_ERROR);
    }
    if (challenge.consumedAt) {
      // One-time-use guard: replay of an already-consumed token is denied.
      throw new UnauthorizedException(GENERIC_RESET_ERROR);
    }
    if (!challenge.otpVerifiedAt) {
      // Refuse to allow a reset without prior OTP verification.
      throw new UnauthorizedException(GENERIC_RESET_ERROR);
    }
    if (!challenge.resetTokenHash || !challenge.resetTokenExpiresAt) {
      throw new UnauthorizedException(GENERIC_RESET_ERROR);
    }
    if (challenge.resetTokenExpiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException(GENERIC_RESET_ERROR);
    }
    if (!challenge.userId) {
      // The challenge must be associated with a real user record.
      throw new UnauthorizedException(GENERIC_RESET_ERROR);
    }

    const expectedHash = this.hashing.hashResetToken(challengeId, secret);
    if (!this.hashing.safeEqual(expectedHash, challenge.resetTokenHash)) {
      throw new UnauthorizedException(GENERIC_RESET_ERROR);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: challenge.userId },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException(GENERIC_RESET_ERROR);
    }

    const newPasswordHash = await this.passwordService.hashPassword(newPassword);
    const now = new Date();

    // ---------------------------------------------------------------
    // Single interactive transaction. ALL side effects happen here.
    // If any step throws, Prisma rolls back the entire group, so the
    // challenge is NOT consumed, the password is NOT updated, refresh
    // tokens are NOT revoked, and tokenVersion is NOT incremented.
    // ---------------------------------------------------------------
    await this.prisma.$transaction(async (tx) => {
      // 1) One-time-use guard: conditionally consume the challenge.
      //    Guards: not a marker, not revoked, not consumed, otp-verified,
      //    reset token not expired, owned by the same user.
      const consumeResult = await tx.passwordRecoveryChallenge.updateMany({
        where: {
          id: challenge.id,
          isMarker: false,
          revokedAt: null,
          consumedAt: null,
          otpVerifiedAt: { not: null },
          resetTokenHash: { not: null },
          resetTokenExpiresAt: { gt: now },
          userId: user.id,
        },
        data: { consumedAt: now },
      });
      if (consumeResult.count === 0) {
        // Lost the race against another reset attempt, or the challenge
        // was revoked / expired / consumed between our read and our
        // update. Abort the whole transaction so no other side effect
        // is applied. The error is thrown out of the transaction body
        // and caught by Prisma, which rolls back automatically.
        throw new UnauthorizedException(GENERIC_RESET_ERROR);
      }

      // 2) Update the user password.
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      });

      if (this.config.revokeSessionsOnSuccess) {
        // 3a) Revoke all active refresh tokens for this user.
        await tx.refreshToken.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: now },
        });

        // 3b) Increment tokenVersion so all access tokens become invalid.
        await tx.user.update({
          where: { id: user.id },
          data: { tokenVersion: { increment: 1 } },
        });
      }

      // 4) Revoke any other active challenges for the same user.
      await tx.passwordRecoveryChallenge.updateMany({
        where: {
          userId: user.id,
          purpose: PASSWORD_RECOVERY_PURPOSES.PASSWORD_RESET,
          revokedAt: null,
          consumedAt: null,
          id: { not: challenge.id },
        },
        data: { revokedAt: now },
      });
    });

    this.logger.log(`Password reset completed for user ${user.id}`);

    // Audit log — non-blocking, safe to fail silently
    await this.auditLogService.log({
      action: AUDIT_ACTIONS.AUTH_PASSWORD_RESET_SUCCESS,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: user.id,
      status: 'SUCCESS',
      actor: { id: user.id, email: user.email },
    });

    return { message: PASSWORD_RECOVERY_RESET_SUCCESS_MESSAGE };
  }
}
