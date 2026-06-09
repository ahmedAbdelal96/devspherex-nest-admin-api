import { Permission } from '@prisma/client';

export interface PermissionResponse {
  id: string;
  key: string;
  resource: string;
  action: string;
  label: string;
  description: string | null;
  group: string;
  isSystem: boolean;
  createdAt: Date;
}

export class PermissionResponseMapper {
  static toResponse(permission: Permission): PermissionResponse {
    return {
      id: permission.id,
      key: permission.key,
      resource: permission.resource,
      action: permission.action,
      label: permission.label,
      description: permission.description,
      group: permission.group,
      isSystem: permission.isSystem,
      createdAt: permission.createdAt,
    };
  }

  static toListResponse(permissions: Permission[]): PermissionResponse[] {
    return permissions.map((p) => this.toResponse(p));
  }
}
