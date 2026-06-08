import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { TokenService } from '../services/token.service';
import { RefreshTokenService } from '../services/refresh-token.service';
import { RefreshTokensRepository } from '../repositories/refresh-tokens.repository';
import { RefreshTokenResponseDto } from '../dto/auth-response.dto';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly refreshTokensRepository: RefreshTokensRepository,
  ) {}

  async execute(refreshToken: string): Promise<RefreshTokenResponseDto> {
    // Find the hashed token in database
    const storedToken = await this.refreshTokensRepository.findValidToken(refreshToken);

    if (!storedToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Verify the raw token against the hash
    const isValid = await this.refreshTokenService.verifyRefreshToken(
      refreshToken,
      storedToken.token,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Get user
    const user = await this.prisma.user.findUnique({
      where: { id: storedToken.userId },
      include: { role: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Revoke old refresh token
    await this.refreshTokensRepository.revoke(refreshToken);

    // Generate new access token
    const accessToken = await this.tokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
    });

    return {
      accessToken,
      expiresIn: this.tokenService.getExpiresIn(),
    };
  }
}
