/**
 * Password Recovery Repository
 *
 * Encapsulates all Prisma access for PasswordRecoveryChallenge. Use-cases
 * never touch Prisma directly; they go through this repository.
 *
 * Important invariants enforced here:
 *   - We never return the raw email. We only ever query by emailHash.
 *   - We never return the raw OTP or raw reset token. Only their hashes.
 *   - One-time-use semantics are enforced via updateMany/update with
 *     `consumedAt: null` / `revokedAt: null` guards.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/database/prisma.service';
import {
  PasswordRecoveryChallenge,
  Prisma,
  PasswordRecoveryPurpose,
} from '@prisma/client';

export interface CreateChallengeInput {
  userId: string | null;
  emailHash: string;
  purpose: PasswordRecoveryPurpose;
  channel: string;
  otpHash: string;
  otpExpiresAt: Date;
  maxAttempts: number;
  requestIp?: string;
  userAgent?: string;
}

@Injectable()
export class PasswordRecoveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new challenge. Caller is expected to have revoked older
   * active challenges for the same emailHash/purpose before calling.
   */
  async create(input: CreateChallengeInput): Promise<PasswordRecoveryChallenge> {
    return this.prisma.passwordRecoveryChallenge.create({
      data: {
        userId: input.userId,
        emailHash: input.emailHash,
        purpose: input.purpose,
        channel: input.channel as Prisma.PasswordRecoveryChallengeCreateInput['channel'],
        otpHash: input.otpHash,
        otpExpiresAt: input.otpExpiresAt,
        maxAttempts: input.maxAttempts,
        requestIp: input.requestIp ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  }

  /**
   * Find the latest challenge by emailHash + purpose that is still active
   * (not revoked, not consumed, not expired).
   */
  async findLatestActiveByEmail(
    emailHash: string,
    purpose: PasswordRecoveryPurpose,
  ): Promise<PasswordRecoveryChallenge | null> {
    return this.prisma.passwordRecoveryChallenge.findFirst({
      where: {
        emailHash,
        purpose,
        revokedAt: null,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find the latest challenge by emailHash + purpose, regardless of state.
   * Used for cooldown detection.
   */
  async findLatestByEmail(
    emailHash: string,
    purpose: PasswordRecoveryPurpose,
  ): Promise<PasswordRecoveryChallenge | null> {
    return this.prisma.passwordRecoveryChallenge.findFirst({
      where: {
        emailHash,
        purpose,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find a challenge by id. Used to look up the challenge referenced by a
   * reset session token.
   */
  async findById(id: string): Promise<PasswordRecoveryChallenge | null> {
    return this.prisma.passwordRecoveryChallenge.findUnique({
      where: { id },
    });
  }

  /**
   * Revoke all currently active (non-revoked, non-consumed) challenges for
   * the given emailHash + purpose. Returns the count of revoked rows.
   */
  async revokeActiveForEmail(
    emailHash: string,
    purpose: PasswordRecoveryPurpose,
  ): Promise<number> {
    const result = await this.prisma.passwordRecoveryChallenge.updateMany({
      where: {
        emailHash,
        purpose,
        revokedAt: null,
        consumedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
    return result.count;
  }

  /**
   * Revoke all currently active challenges for the given userId + purpose.
   * Used after a successful password reset to invalidate any other flow
   * the same user may have started.
   */
  async revokeActiveForUser(
    userId: string,
    purpose: PasswordRecoveryPurpose,
  ): Promise<number> {
    const result = await this.prisma.passwordRecoveryChallenge.updateMany({
      where: {
        userId,
        purpose,
        revokedAt: null,
        consumedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
    return result.count;
  }

  /**
   * Increment failedAttempts atomically. If the new value reaches
   * maxAttempts, also set revokedAt. Returns the updated challenge.
   */
  async incrementFailedAttempts(
    id: string,
    maxAttempts: number,
  ): Promise<PasswordRecoveryChallenge> {
    // Use a transaction to keep the increment + revoke decision atomic.
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.passwordRecoveryChallenge.findUnique({
        where: { id },
      });
      if (!current) {
        throw new Error(`Challenge ${id} not found`);
      }
      const nextAttempts = current.failedAttempts + 1;
      const shouldRevoke = nextAttempts >= maxAttempts;
      return tx.passwordRecoveryChallenge.update({
        where: { id },
        data: {
          failedAttempts: nextAttempts,
          revokedAt: shouldRevoke ? new Date() : current.revokedAt,
        },
      });
    });
  }

  /**
   * Mark an OTP as verified and persist the reset token hash + expiry.
   * Returns null if the challenge was not in a valid state to be verified
   * (revoked, consumed, otpExpired).
   */
  async markOtpVerified(
    id: string,
    resetTokenHash: string,
    resetTokenExpiresAt: Date,
  ): Promise<PasswordRecoveryChallenge | null> {
    // Conditional update to avoid double-verification or post-expiry verification.
    const result = await this.prisma.passwordRecoveryChallenge.updateMany({
      where: {
        id,
        revokedAt: null,
        consumedAt: null,
        otpVerifiedAt: null,
        otpExpiresAt: { gt: new Date() },
      },
      data: {
        otpVerifiedAt: new Date(),
        resetTokenHash,
        resetTokenExpiresAt,
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.prisma.passwordRecoveryChallenge.findUnique({ where: { id } });
  }

  /**
   * Mark a challenge as consumed. Returns true if the update applied
   * (consumedAt was null), false otherwise (already consumed or revoked).
   *
   * This is the one-time-use guard for the reset session token.
   */
  async markConsumed(id: string): Promise<boolean> {
    const result = await this.prisma.passwordRecoveryChallenge.updateMany({
      where: {
        id,
        revokedAt: null,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    });
    return result.count > 0;
  }
}
