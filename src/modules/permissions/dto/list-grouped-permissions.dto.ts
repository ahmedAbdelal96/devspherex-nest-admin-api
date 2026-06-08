export class ListGroupedPermissionsResponseDto {
  groups: Array<{
    groupName: string;
    permissions: Array<{
      id: string;
      name: string;
      description: string | null;
    }>;
  }>;
}
