import { Injectable } from '@nestjs/common';
import { PermissionsRepository } from '../repositories/permissions.repository';
import { ListGroupedPermissionsResponseDto } from '../dto/list-grouped-permissions.dto';

@Injectable()
export class ListGroupedPermissionsUseCase {
  constructor(private readonly permissionsRepository: PermissionsRepository) {}

  async execute(): Promise<ListGroupedPermissionsResponseDto> {
    const permissions = await this.permissionsRepository.findAllGrouped();

    // Group permissions by groupName
    const grouped = permissions.reduce(
      (acc, perm) => {
        const group = acc[perm.groupName] || [];
        group.push({
          id: perm.id,
          name: perm.name,
          description: perm.description,
        });
        acc[perm.groupName] = group;
        return acc;
      },
      {} as Record<string, Array<{ id: string; name: string; description: string | null }>>,
    );

    return {
      groups: Object.entries(grouped).map(([groupName, permissions]) => ({
        groupName,
        permissions,
      })),
    };
  }
}
