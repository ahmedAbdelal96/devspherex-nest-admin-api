import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';

@Injectable()
export class LogoutAllUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Logout from all devices.
   * Revokes all refresh tokens and increments tokenVersion.
   */
  async execute(userId: string): Promise<void> {
    await this.prisma.$transaction([
      // Revoke all refresh tokens
      this.prisma.refreshToken.updateMany({
        where: { userId },
        data: { revokedAt: new Date() },
      }),
      // Increment tokenVersion to invalidate existing access tokens
      this.prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      }),
    ]);
  }
}