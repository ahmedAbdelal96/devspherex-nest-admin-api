import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { PasswordService } from '../services/password.service';
import { ChangePasswordDto } from '../dto/change-password.dto';

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  async execute(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isCurrentPasswordValid = await this.passwordService.verifyPassword(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    const newPasswordHash = await this.passwordService.hashPassword(dto.newPassword);

    // Use transaction to update password, revoke tokens, and increment tokenVersion
    await this.prisma.$transaction([
      // Update password hash
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      }),
      // Revoke all refresh tokens using prisma directly
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