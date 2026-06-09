import { Injectable, UnauthorizedException } from '@nestjs/common';
import { TokenService } from '../services/token.service';
import { RefreshTokenService } from '../services/refresh-token.service';
import { RefreshTokensRepository } from '../repositories/refresh-tokens.repository';
import { RefreshTokenResponseDto } from '../dto/auth-response.dto';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    private readonly tokenService: TokenService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly refreshTokensRepository: RefreshTokensRepository,
  ) {}

  async execute(rawRefreshToken: string): Promise<RefreshTokenResponseDto> {
    // Extract jti from the raw token
    const jti = this.refreshTokenService.extractJti(rawRefreshToken);
    if (!jti) {
      throw new UnauthorizedException('Invalid refresh token format');
    }

    // Find token by jti
    const storedToken = await this.refreshTokensRepository.findByJti(jti);
    if (!storedToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Check if token is revoked
    if (storedToken.revokedAt) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    // Check if token is expired
    if (new Date() > storedToken.expiresAt) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Verify the raw token against the stored hash
    const isValid = this.refreshTokenService.verifyRefreshToken(
      rawRefreshToken,
      storedToken.tokenHash,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Load user to generate new access token
    const user = await this.refreshTokensRepository.findUserById(storedToken.userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Generate new access token with current tokenVersion
    const accessToken = await this.tokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
      tokenVersion: user.tokenVersion,
    });

    return {
      accessToken,
      expiresIn: this.tokenService.getExpiresIn(),
    };
  }
}