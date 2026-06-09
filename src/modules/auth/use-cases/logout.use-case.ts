import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { RefreshTokenService } from '../services/refresh-token.service';
import { RefreshTokensRepository } from '../repositories/refresh-tokens.repository';

@Injectable()
export class LogoutUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly refreshTokensRepository: RefreshTokensRepository,
  ) {}

  async execute(userId: string, rawRefreshToken: string): Promise<void> {
    // Extract jti from the raw token
    const jti = this.refreshTokenService.extractJti(rawRefreshToken);
    if (!jti) {
      throw new UnauthorizedException('Invalid refresh token format');
    }

    // Find the token by jti
    const storedToken = await this.refreshTokensRepository.findByJti(jti);
    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Verify the token belongs to this user
    if (storedToken.userId !== userId) {
      throw new UnauthorizedException('Token does not belong to user');
    }

    // Reject if already revoked
    if (storedToken.revokedAt) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    // Reject if expired
    if (new Date() > storedToken.expiresAt) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Verify the raw token against stored hash
    const isValid = await this.refreshTokenService.verifyRefreshTokenAsync(
      rawRefreshToken,
      storedToken.tokenHash,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Revoke the refresh token
    await this.refreshTokensRepository.revokeByJti(jti);

    // Increment tokenVersion to invalidate existing access tokens
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
  }
}