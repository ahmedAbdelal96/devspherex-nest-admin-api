import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { User, UserStatus, Prisma, Role, Permission } from '@prisma/client';

// User with role that includes permissions (when fetched with include)
type RoleWithPermissions = Role & {
  permissions: Array<{
    permission: Permission;
  }>;
};

type UserWithRole = User & {
  role: RoleWithPermissions | null;
};

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    roleId?: string;
  }): Promise<UserWithRole> {
    return this.prisma.user.create({
      data,
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
      },
    }) as Promise<UserWithRole>;
  }

  async findById(id: string): Promise<UserWithRole | null> {
    return this.prisma.user.findUnique({
      where: { id },
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
      },
    }) as Promise<UserWithRole | null>;
  }

  async findByEmail(email: string): Promise<UserWithRole | null> {
    return this.prisma.user.findUnique({
      where: { email },
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
      },
    }) as Promise<UserWithRole | null>;
  }

  async findAll(params: {
    search?: string;
    status?: UserStatus;
    roleId?: string;
    page: number;
    limit: number;
  }): Promise<{ data: UserWithRole[]; total: number }> {
    const { search, status, roleId, page, limit } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (roleId) {
      where.roleId = roleId;
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
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
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: data as UserWithRole[], total };
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<UserWithRole> {
    return this.prisma.user.update({
      where: { id },
      data,
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
      },
    }) as Promise<UserWithRole>;
  }

  async updateStatus(id: string, status: UserStatus): Promise<UserWithRole> {
    return this.prisma.user.update({
      where: { id },
      data: { status },
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
      },
    }) as Promise<UserWithRole>;
  }

  async updateRole(id: string, roleId: string | null): Promise<UserWithRole> {
    return this.prisma.user.update({
      where: { id },
      data: { roleId },
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
      },
    }) as Promise<UserWithRole>;
  }

  async delete(id: string): Promise<User> {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { id },
    });
    return count > 0;
  }

  async getPermissionOverrides(userId: string): Promise<string[]> {
    const overrides = await this.prisma.userPermissionOverride.findMany({
      where: { userId },
      select: { permissionId: true },
    });
    return overrides.map((o) => o.permissionId);
  }

  async setPermissionOverrides(userId: string, permissionIds: string[]): Promise<void> {
    // Remove existing overrides
    await this.prisma.userPermissionOverride.deleteMany({
      where: { userId },
    });

    // Add new overrides
    if (permissionIds.length > 0) {
      await this.prisma.userPermissionOverride.createMany({
        data: permissionIds.map((permissionId) => ({
          userId,
          permissionId,
        })),
      });
    }
  }
}