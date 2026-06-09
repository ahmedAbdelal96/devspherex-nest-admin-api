import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { TokenService } from '../services/token.service';
import { RefreshTokenService } from '../services/refresh-token.service';
import { RefreshTokensRepository } from '../repositories/refresh-tokens.repository';
import { RefreshTokenResponseDto } from '../dto/auth-response.dto';

// TODO [Phase 3]: Implement proper refresh token rotation with jti/familyId reuse detection

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly refreshTokensRepository: RefreshTokensRepository,
  ) {}

  async execute(refreshToken: string): Promise<RefreshTokenResponseDto> {
    // NOTE: In Phase 3, this will use jti for token tracking
    // For Phase 1B, we do basic token lookup
    const user = await this.prisma.user.findFirst({
      where: {
        refreshTokens: {
          some: {
            tokenHash: refreshToken,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        },
      },
      include: { role: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Generate new access token
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
