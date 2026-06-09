import { User, Role } from '@prisma/client';

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  phone: string | null;
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

// Helper type for user with role and permission overrides
type UserWithRoleAndOverrides = User & {
  role: Role | null;
  permissionOverrides?: Array<{ permission: { key: string } }>;
};

export class UserResponseMapper {
  static toResponse(user: User & { role: Role | null }): UserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
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
    user: UserWithRoleAndOverrides,
    rolePermissions?: string[],
  ): UserWithPermissionsResponse {
    const baseResponse = this.toResponse(user);

    // Permission key is now stored as 'key' not 'name'
    const overridePermissions =
      user.permissionOverrides?.map((o) => o.permission.key) || [];
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