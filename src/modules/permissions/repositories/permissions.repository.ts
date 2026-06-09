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

  async findByKey(key: string): Promise<Permission | null> {
    return this.prisma.permission.findUnique({
      where: { key },
    });
  }

  async findAll(params: {
    search?: string;
    group?: string;
    page: number;
    limit: number;
  }): Promise<{ data: Permission[]; total: number }> {
    const { search, group, page, limit } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.PermissionWhereInput = {};

    if (search) {
      where.OR = [
        { key: { contains: search, mode: 'insensitive' } },
        { label: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (group) {
      where.group = group;
    }

    const [data, total] = await Promise.all([
      this.prisma.permission.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ group: 'asc' }, { key: 'asc' }],
      }),
      this.prisma.permission.count({ where }),
    ]);

    return { data, total };
  }

  async findAllGrouped(): Promise<Permission[]> {
    return this.prisma.permission.findMany({
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
  }

  async findByIds(ids: string[]): Promise<Permission[]> {
    return this.prisma.permission.findMany({
      where: { id: { in: ids } },
    });
  }
}
