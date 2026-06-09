import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { RefreshToken } from '@prisma/client';

@Injectable()
export class RefreshTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    tokenHash: string;
    userId: string;
    jti: string;
    familyId: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({
      data,
    });
  }

  async findByJti(jti: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({
      where: { jti },
    });
  }

  async findValidToken(jti: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findFirst({
      where: {
        jti,
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
    });
  }

  async revoke(tokenId: string, replacedByTokenId?: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id: tokenId },
      data: {
        revokedAt: new Date(),
        replacedByTokenId,
      },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });
  }

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  }

  async findById(id: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({
      where: { id },
    });
  }
}
