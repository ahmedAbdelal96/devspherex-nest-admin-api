export class ListGroupedPermissionsResponseDto {
  groups: Array<{
    group: string;
    permissions: Array<{
      id: string;
      key: string;
      label: string;
      description: string | null;
    }>;
  }>;
}
