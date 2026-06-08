import { User, Role } from '@prisma/client';

export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: User['status'];
  role: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithPermissionsResponse extends UserResponse {
  permissions: string[];
}

export class UserResponseMapper {
  static toResponse(user: User & { role: Role | null }): UserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      role: user.role
        ? {
            id: user.role.id,
            name: user.role.name,
            description: user.role.description,
          }
        : null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  static toResponseWithPermissions(
    user: User & { role: Role | null; permissionOverrides?: Array<{ permission: { name: string } }> },
    rolePermissions?: string[],
  ): UserWithPermissionsResponse {
    const baseResponse = this.toResponse(user);

    const overridePermissions =
      user.permissionOverrides?.map((o) => o.permission.name) || [];
    const allPermissions = [
      ...new Set([...(rolePermissions || []), ...overridePermissions]),
    ];

    return {
      ...baseResponse,
      permissions: allPermissions,
    };
  }

  static toListResponse(users: Array<User & { role: Role | null }>): UserResponse[] {
    return users.map((user) => this.toResponse(user));
  }
}
