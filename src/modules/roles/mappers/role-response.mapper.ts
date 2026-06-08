import { Role, Permission } from '@prisma/client';

export interface RoleResponse {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: Array<{
    id: string;
    name: string;
    groupName: string;
    description: string | null;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export class RoleResponseMapper {
  static toResponse(
    role: Role& {
      permissions: Array<{
        permission: Permission;
      }>;
    },
  ): RoleResponse {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.permissions.map((rp) => ({
        id: rp.permission.id,
        name: rp.permission.name,
        groupName: rp.permission.groupName,
        description: rp.permission.description,
      })),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  static toListResponse(
    roles: Array<
      Role & {
        permissions: Array<{
          permission: Permission;
        }>;
      }
    >,
  ): RoleResponse[] {
    return roles.map((role) => this.toResponse(role));
  }
}
