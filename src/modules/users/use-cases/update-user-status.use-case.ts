import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { UsersRepository } from '../repositories/users.repository';
import { UsersPolicy } from '../policies/users.policy';
import { UpdateUserStatusDto } from '../dto/update-user-status.dto';
import { UserResponseMapper } from '../mappers/user-response.mapper';

@Injectable()
export class UpdateUserStatusUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersRepository: UsersRepository,
    private readonly usersPolicy: UsersPolicy,
  ) {}

  async execute(userId: string, dto: UpdateUserStatusDto, currentUserId: string) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.usersPolicy.preventDeactivatingSelf(currentUserId, userId);

    // If disabling a user (status changing from ACTIVE), invalidate all tokens
    if (user.status === 'ACTIVE' && dto.status !== 'ACTIVE') {
      // Use transaction to revoke tokens and update status+tokenVersion
      await this.prisma.$transaction([
        // Revoke all refresh tokens using prisma directly
        this.prisma.refreshToken.updateMany({
          where: { userId },
          data: { revokedAt: new Date() },
        }),
        // Update status and increment tokenVersion
        this.prisma.user.update({
          where: { id: userId },
          data: {
            status: dto.status,
            tokenVersion: { increment: 1 },
          },
        }),
      ]);
    } else {
      // Just update status without token invalidation
      await this.usersRepository.updateStatus(userId, dto.status);
    }

    const updatedUser = await this.usersRepository.findById(userId);
    return UserResponseMapper.toResponse(updatedUser!);
  }
}