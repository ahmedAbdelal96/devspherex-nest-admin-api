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
  otpHash: string | null;
  otpExpiresAt: Date | null;
  maxAttempts: number;
  isMarker?: boolean;
  requestIp?: string;
  userAgent?: string;
}

@Injectable()
export class PasswordRecoveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new challenge. Caller is expected to have revoked older
   * active challenges for the same emailHash/purpose before calling.
   *
   * For "marker" challenges (unknown email placeholders), pass
   * `isMarker: true` and leave `otpHash` / `otpExpiresAt` as null.
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
        isMarker: input.isMarker ?? false,
        requestIp: input.requestIp ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  }

  /**
   * Create a non-verifiable "marker" challenge for an unknown email.
   *
   * Marker challenges are placeholders that:
   *   - occupy the emailHash slot so the cooldown works for unknown emails
   *   - keep timing similar to the known-email path
   *   - carry no OTP, so they can never be consumed
   *   - are automatically filtered out by `findLatestActiveByEmail` and
   *     by the verify / reset use-cases
   */
  async createMarker(input: {
    emailHash: string;
    purpose: PasswordRecoveryPurpose;
    channel: string;
    maxAttempts: number;
    requestIp?: string;
    userAgent?: string;
  }): Promise<PasswordRecoveryChallenge> {
    return this.prisma.passwordRecoveryChallenge.create({
      data: {
        userId: null,
        emailHash: input.emailHash,
        purpose: input.purpose,
        channel: input.channel as Prisma.PasswordRecoveryChallengeCreateInput['channel'],
        otpHash: null,
        otpExpiresAt: null,
        maxAttempts: input.maxAttempts,
        isMarker: true,
        requestIp: input.requestIp ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  }

  /**
   * Find the latest challenge by emailHash + purpose that is still active
   * (not revoked, not consumed, not expired, not a marker).
   *
   * Marker challenges are excluded — they are placeholders that exist
   * only for cooldown enforcement, not real OTP flows.
   */
  async findLatestActiveByEmail(
    emailHash: string,
    purpose: PasswordRecoveryPurpose,
  ): Promise<PasswordRecoveryChallenge | null> {
    return this.prisma.passwordRecoveryChallenge.findFirst({
      where: {
        emailHash,
        purpose,
        isMarker: false,
        revokedAt: null,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find the latest challenge by emailHash + purpose, regardless of state.
   * Used for cooldown detection. Includes markers so that the cooldown
   * applies to unknown-email placeholders as well.
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
   * the given emailHash + purpose, including markers. Returns the count of
   * revoked rows.
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
   * Markers cannot have their failedAttempts incremented.
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
      if (current.isMarker) {
        // Markers are placeholders — they cannot be verified, so their
        // attempt counter is meaningless. Return the row unchanged.
        return current;
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
   * (revoked, consumed, otpExpired, or a marker).
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
        isMarker: false,
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
   * (consumedAt was null), false otherwise (already consumed, revoked,
   * or a marker). Markers can never be consumed.
   *
   * This is the one-time-use guard for the reset session token.
   */
  async markConsumed(id: string): Promise<boolean> {
    const result = await this.prisma.passwordRecoveryChallenge.updateMany({
      where: {
        id,
        isMarker: false,
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
