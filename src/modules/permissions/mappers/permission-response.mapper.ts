import { Permission } from '@prisma/client';

export interface PermissionResponse {
  id: string;
  name: string;
  description: string | null;
  groupName: string;
  createdAt: Date;
}

export class PermissionResponseMapper {
  static toResponse(permission: Permission): PermissionResponse {
    return {
      id: permission.id,
      name: permission.name,
      description: permission.description,
      groupName: permission.groupName,
      createdAt: permission.createdAt,
    };
  }

  static toListResponse(permissions: Permission[]): PermissionResponse[] {
    return permissions.map((p) => this.toResponse(p));
  }
}
