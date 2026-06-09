import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class RefreshTokenService {
  private readonly HASH_ROUNDS = 12;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Generate a raw refresh token and its associated data.
   * The raw token is sent to the client.
   * Only the hash is stored in the database.
   *
   * Format: `${jti}.${secret}`
   * - jti: unique token ID for lookup
   * - secret: 64 random hex characters
   */
  generateRefreshTokenPayload(): {
    rawToken: string;
    jti: string;
    familyId: string;
    tokenHash: string;
    expiresAt: Date;
  } {
    const jti = randomUUID();
    const familyId = randomUUID();
    const secret = randomBytes(32).toString('hex'); // 64 hex chars
    const rawToken = `${jti}.${secret}`;
    const tokenHash = bcrypt.hashSync(rawToken, this.HASH_ROUNDS);
    const expiresAt = this.getRefreshTokenExpiry();

    return {
      rawToken,
      jti,
      familyId,
      tokenHash,
      expiresAt,
    };
  }

  /**
   * Extract jti from a raw refresh token.
   * Returns null if token format is invalid.
   */
  extractJti(rawToken: string): string | null {
    const parts = rawToken.split('.');
    if (parts.length !== 2) {
      return null;
    }
    return parts[0]; // jti is the first part
  }

  /**
   * Verify a raw refresh token against a stored hash.
   */
  verifyRefreshToken(rawToken: string, tokenHash: string): boolean {
    try {
      return bcrypt.compareSync(rawToken, tokenHash);
    } catch {
      return false;
    }
  }

  /**
   * Get the expiry date for refresh tokens.
   */
  getRefreshTokenExpiry(): Date {
    const expiresIn = this.configService.get('jwt.refreshExpiresIn') as string;
    const match = expiresIn.match(/^(\d+)([mhd])$/);

    if (!match) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // default 7 days
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];
    const now = new Date();

    switch (unit) {
      case 'm':
        return new Date(now.getTime() + value * 60 * 1000);
      case 'h':
        return new Date(now.getTime() + value * 3600 * 1000);
      case 'd':
        return new Date(now.getTime() + value * 24 * 3600 * 1000);
      default:
        return new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    }
  }
}