import { Injectable, ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../common/database/prisma.service';
import { PasswordService } from '../services/password.service';
import { TokenService } from '../services/token.service';
import { RefreshTokenService } from '../services/refresh-token.service';
import { RefreshTokensRepository } from '../repositories/refresh-tokens.repository';
import { RegisterDto } from '../dto/register.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';

@Injectable()
export class RegisterUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly refreshTokensRepository: RefreshTokensRepository,
  ) {}

  async execute(dto: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await this.passwordService.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
      },
      include: {
        role: true,
      },
    });

    const accessToken = await this.tokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
      tokenVersion: user.tokenVersion,
    });

    const refreshToken = await this.refreshTokenService.generateRefreshToken();
    const expiresAt = this.refreshTokenService.getRefreshTokenExpiry();
    const jti = randomUUID();
    const familyId = randomUUID();

    await this.refreshTokensRepository.create({
      tokenHash: refreshToken,
      userId: user.id,
      jti,
      familyId,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.tokenService.getExpiresIn(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }
}
