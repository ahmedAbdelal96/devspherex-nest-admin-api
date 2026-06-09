import { Role, Permission } from '@prisma/client';

export interface RoleResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: Role['status'];
  isSystem: boolean;
  permissions: Array<{
    id: string;
    key: string;
    resource: string;
    action: string;
    label: string;
    group: string;
    description: string | null;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export class RoleResponseMapper {
  static toResponse(
    role: Role & {
      permissions: Array<{
        permission: Permission;
      }>;
    },
  ): RoleResponse {
    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      status: role.status,
      isSystem: role.isSystem,
      permissions: role.permissions.map((rp) => ({
        id: rp.permission.id,
        key: rp.permission.key,
        resource: rp.permission.resource,
        action: rp.permission.action,
        label: rp.permission.label,
        group: rp.permission.group,
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
