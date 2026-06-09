/**
 * Reset Password With Token Use-Case
 *
 * Step 3 of the password recovery flow. Public endpoint, no authentication.
 *
 * Security contract:
 *   - Accepts a resetSessionToken (`<challengeId>.<secret>`).
 *   - The challenge must exist, not be revoked, not be consumed, must have
 *     been OTP-verified, and the reset session token must not be expired.
 *   - The hash of the token is verified in constant time.
 *   - All writes happen inside a Prisma transaction:
 *       * update user passwordHash
 *       * revoke all refresh tokens for the user
 *       * increment user.tokenVersion
 *       * mark the challenge as consumed (one-time-use guard)
 *       * revoke any other active challenges for the same user
 *   - The `consumedAt` is set via a conditional update with
 *     `consumedAt: null, revokedAt: null` guards, so a double-submit
 *     cannot apply the password change twice.
 *   - Old sessions are revoked and tokenVersion is incremented, which
 *     invalidates all access tokens (handled by JwtStrategy in Phase 3).
 */

import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';
import { PasswordService } from '../../services/password.service';
import { PasswordRecoveryConfig } from '../password-recovery.config';
import { PasswordRecoveryHashingService } from '../services/password-recovery-hashing.service';
import { PasswordRecoveryTokenService } from '../services/password-recovery-token.service';
import { PasswordRecoveryRepository } from '../repositories/password-recovery.repository';
import { PASSWORD_RECOVERY_PURPOSES } from '../password-recovery.types';
import { PASSWORD_RECOVERY_RESET_SUCCESS_MESSAGE } from '../password-recovery.constants';

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
    private readonly repository: PasswordRecoveryRepository,
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

    const challenge = await this.repository.findById(challengeId);
    if (!challenge) {
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

    // Atomic transaction: one-time-use guard + side effects.
    const consumed = await this.repository.markConsumed(challenge.id);
    if (!consumed) {
      // Lost the race against another reset attempt.
      throw new UnauthorizedException(GENERIC_RESET_ERROR);
    }

    const txOps: Prisma.PrismaPromise<unknown>[] = [];

    // Update the password.
    txOps.push(
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      }),
    );

    if (this.config.revokeSessionsOnSuccess) {
      // Revoke all refresh tokens for this user.
      txOps.push(
        this.prisma.refreshToken.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
      );

      // Increment tokenVersion so all access tokens become invalid.
      txOps.push(
        this.prisma.user.update({
          where: { id: user.id },
          data: { tokenVersion: { increment: 1 } },
        }),
      );
    }

    // Revoke any other active challenges for the same user.
    txOps.push(
      this.prisma.passwordRecoveryChallenge.updateMany({
        where: {
          userId: user.id,
          purpose: PASSWORD_RECOVERY_PURPOSES.PASSWORD_RESET,
          revokedAt: null,
          consumedAt: null,
          id: { not: challenge.id },
        },
        data: { revokedAt: new Date() },
      }),
    );

    await this.prisma.$transaction(txOps);

    this.logger.log(`Password reset completed for user ${user.id}`);

    return { message: PASSWORD_RECOVERY_RESET_SUCCESS_MESSAGE };
  }
}
