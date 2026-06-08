import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';

@Injectable()
export class ForgotPasswordUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(email: string): Promise<{ message: string }> {
    // Always return success to prevent email enumeration
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // TODO: Send email with reset link
      // In production, integrate with email service (SendGrid, SES, etc.)
      console.log(`Password reset requested for: ${email}`);
    }

    return {
      message: 'If an account exists with this email, a password reset link has been sent',
    };
  }
}
