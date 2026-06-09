import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { UsersRepository } from '../repositories/users.repository';

@Injectable()
export class GetUserEffectivePermissionsUseCase {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(userId: string) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Permission key is now stored as 'key' not 'name'
    const rolePermissions = user.role?.permissions.map((rp) => rp.permission.key) || [];

    // Get user permission overrides
    const overridePermissions = await this.usersRepository.getPermissionOverrides(userId);

    // Get permission details for overrides
    const overridePermissionDetails = await Promise.all(
      overridePermissions.map(async (permId) => {
        const perm = await this.prisma.permission.findUnique({
          where: { id: permId },
        });
        return perm?.key || null;
      }),
    );

    // Combine and dedupe
    const allPermissions = [
      ...new Set([...rolePermissions, ...overridePermissionDetails.filter(Boolean)]),
    ];

    return {
      userId: user.id,
      rolePermissions,
      overridePermissions: overridePermissionDetails.filter(Boolean),
      effectivePermissions: allPermissions,
    };
  }
}
