import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { Role, RoleStatus, Prisma, Permission } from '@prisma/client';

type RoleWithPermissions = Role & {
  permissions: Array<{
    permission: Permission;
  }>;
};

@Injectable()
export class RolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    name: string;
    slug: string;
    description?: string;
    permissionIds?: string[];
  }): Promise<RoleWithPermissions> {
    // Create role first
    const role = await this.prisma.role.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        status: 'ACTIVE' as RoleStatus,
      },
    });

    // Connect permissions if provided
    if (data.permissionIds && data.permissionIds.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: data.permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
      });
    }

    // Return with permissions
    return this.findById(role.id) as Promise<RoleWithPermissions>;
  }

  async findById(id: string): Promise<RoleWithPermissions | null> {
    return this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    }) as Promise<RoleWithPermissions | null>;
  }

  async findBySlug(slug: string): Promise<RoleWithPermissions | null> {
    return this.prisma.role.findUnique({
      where: { slug },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    }) as Promise<RoleWithPermissions | null>;
  }

  async findAll(params: {
    search?: string;
    status?: RoleStatus;
    page: number;
    limit: number;
  }): Promise<{ data: RoleWithPermissions[]; total: number }> {
    const { search, status, page, limit } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.RoleWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const [data, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.role.count({ where }),
    ]);

    return { data: data as RoleWithPermissions[], total };
  }

  async update(
    id: string,
    data: Prisma.RoleUpdateInput,
  ): Promise<RoleWithPermissions> {
    return this.prisma.role.update({
      where: { id },
      data,
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    }) as Promise<RoleWithPermissions>;
  }

  async delete(id: string): Promise<Role> {
    return this.prisma.role.delete({
      where: { id },
    });
  }

  async setPermissions(roleId: string, permissionIds: string[]): Promise<void> {
    // Remove existing permissions
    await this.prisma.rolePermission.deleteMany({
      where: { roleId },
    });

    // Add new permissions
    if (permissionIds.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId,
          permissionId,
        })),
      });
    }
  }

  async countUsersWithRole(roleId: string): Promise<number> {
    return this.prisma.user.count({
      where: { roleId },
    });
  }
}
