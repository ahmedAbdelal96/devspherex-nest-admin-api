import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';

export interface CurrentUserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string | null;
  status: string;
  role: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  permissions: string[];
}

@Injectable()
export class GetMeUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string): Promise<CurrentUserData> {
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
      throw new NotFoundException('User not found');
    }

    // Collect all permissions (role + overrides)
    const rolePermissions = user.role?.permissions.map((rp) => rp.permission.name) || [];
    const overridePermissions = user.permissionOverrides.map((up) => up.permission.name);
    const allPermissions = [...new Set([...rolePermissions, ...overridePermissions])];

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roleId: user.roleId,
      status: user.status,
      role: user.role
        ? {
            id: user.role.id,
            name: user.role.name,
            description: user.role.description,
          }
        : null,
      permissions: allPermissions,
    };
  }
}
