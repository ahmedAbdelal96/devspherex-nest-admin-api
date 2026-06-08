import { Injectable, NotFoundException } from '@nestjs/common';
import { RolesRepository } from '../repositories/roles.repository';
import { RolesPolicy } from '../policies/roles.policy';
import { UpdateRolePermissionsDto } from '../dto/update-role-permissions.dto';
import { RoleResponseMapper } from '../mappers/role-response.mapper';

@Injectable()
export class UpdateRolePermissionsUseCase {
  constructor(
    private readonly rolesRepository: RolesRepository,
    private readonly rolesPolicy: RolesPolicy,
  ) {}

  async execute(roleId: string, dto: UpdateRolePermissionsDto) {
    const role = await this.rolesRepository.findById(roleId);

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    await this.rolesPolicy.preventModifyingSystemRolePermissions(roleId);

    await this.rolesRepository.setPermissions(roleId, dto.permissionIds);

    const updatedRole = await this.rolesRepository.findById(roleId);

    return RoleResponseMapper.toResponse(updatedRole!);
  }
}
