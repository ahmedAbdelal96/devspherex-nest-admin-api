import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { PasswordService } from '../services/password.service';
import { ResetPasswordDto } from '../dto/reset-password.dto';

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  async execute(dto: ResetPasswordDto): Promise<{ message: string }> {
    // TODO: Implement proper token storage and validation
    // For now, this is a simplified version
    // In production, store reset tokens in a separate table with expiry

    if (!dto.token || dto.token.length < 10) {
      throw new UnauthorizedException('Invalid reset token');
    }

    // Find user by token (in production, lookup from password_reset_tokens table)
    const user = await this.prisma.user.findFirst({
      where: {
        // In production: find by reset token
 // For now, we'll just validate the token format
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const newPasswordHash = await this.passwordService.hashPassword(dto.newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    return {
      message: 'Password has been reset successfully',
    };
  }
}
