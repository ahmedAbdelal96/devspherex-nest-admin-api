import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';

@Injectable()
export class EffectivePermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEffectivePermissionsForUser(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        permissionOverrides: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!user) {
      return [];
    }

    // Permission key is now stored as 'key' not 'name'
    const rolePermissions = user.role?.permissions.map((rp) => rp.permission.key) || [];
    const overridePermissions = user.permissionOverrides.map((up) => up.permission.key);

    return [...new Set([...rolePermissions, ...overridePermissions])];
  }

  async getEffectivePermissionsForRole(roleId: string): Promise<string[]> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      return [];
    }

    return role.permissions.map((rp) => rp.permission.key);
  }
}
