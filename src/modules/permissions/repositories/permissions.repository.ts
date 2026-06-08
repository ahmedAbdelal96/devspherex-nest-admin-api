import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { Permission, Prisma } from '@prisma/client';

@Injectable()
export class PermissionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Permission | null> {
    return this.prisma.permission.findUnique({
      where: { id },
    });
  }

  async findByName(name: string): Promise<Permission | null> {
    return this.prisma.permission.findUnique({
      where: { name },
    });
  }

  async findAll(params: {
    search?: string;
    groupName?: string;
    page: number;
    limit: number;
  }): Promise<{ data: Permission[]; total: number }> {
    const { search, groupName, page, limit } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.PermissionWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (groupName) {
      where.groupName = groupName;
    }

    const [data, total] = await Promise.all([
      this.prisma.permission.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ groupName: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.permission.count({ where }),
    ]);

    return { data, total };
  }

  async findAllGrouped(): Promise<Permission[]> {
    return this.prisma.permission.findMany({
      orderBy: [{ groupName: 'asc' }, { name: 'asc' }],
    });
  }

  async findByIds(ids: string[]): Promise<Permission[]> {
    return this.prisma.permission.findMany({
      where: { id: { in: ids } },
    });
  }
}
