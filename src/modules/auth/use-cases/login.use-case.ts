import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { PasswordService } from '../services/password.service';
import { TokenService } from '../services/token.service';
import { RefreshTokenService } from '../services/refresh-token.service';
import { RefreshTokensRepository } from '../repositories/refresh-tokens.repository';
import { LoginDto } from '../dto/login.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly refreshTokensRepository: RefreshTokensRepository,
  ) {}

  async execute(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.passwordService.verifyPassword(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is not active');
    }

    // Generate access token with tokenVersion
    const accessToken = await this.tokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
      tokenVersion: user.tokenVersion,
    });

    // Generate refresh token payload (returns raw token + hash for storage)
    const { rawToken, jti, familyId, tokenHash, expiresAt } =
      this.refreshTokenService.generateRefreshTokenPayload();

    // Store hash in database, NOT the raw token
    await this.refreshTokensRepository.create({
      tokenHash,
      userId: user.id,
      jti,
      familyId,
      expiresAt,
    });

    // Return raw token to client (NOT the hash)
    return {
      accessToken,
      refreshToken: rawToken,
      expiresIn: this.tokenService.getExpiresIn(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }
}