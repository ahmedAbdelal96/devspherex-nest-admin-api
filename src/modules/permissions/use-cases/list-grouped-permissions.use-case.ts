import { Injectable } from '@nestjs/common';
import { PermissionsRepository } from '../repositories/permissions.repository';
import { ListGroupedPermissionsResponseDto } from '../dto/list-grouped-permissions.dto';

@Injectable()
export class ListGroupedPermissionsUseCase {
  constructor(private readonly permissionsRepository: PermissionsRepository) {}

  async execute(): Promise<ListGroupedPermissionsResponseDto> {
    const permissions = await this.permissionsRepository.findAllGrouped();

    // Group permissions by group
    const grouped = permissions.reduce(
      (acc, perm) => {
        const group = acc[perm.group] || [];
        group.push({
          id: perm.id,
          key: perm.key,
          label: perm.label,
          description: perm.description,
        });
        acc[perm.group] = group;
        return acc;
      },
      {} as Record<string, Array<{ id: string; key: string; label: string; description: string | null }>>,
    );

    return {
      groups: Object.entries(grouped).map(([group, permissions]) => ({
        group,
        permissions,
      })),
    };
  }
}
