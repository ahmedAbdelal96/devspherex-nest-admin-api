import { Injectable, NotFoundException } from '@nestjs/common';
import { RolesRepository } from '../repositories/roles.repository';
import { RolesPolicy } from '../policies/roles.policy';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { RoleResponseMapper } from '../mappers/role-response.mapper';

@Injectable()
export class UpdateRoleUseCase {
  constructor(
    private readonly rolesRepository: RolesRepository,
    private readonly rolesPolicy: RolesPolicy,
  ) {}

  async execute(roleId: string, dto: UpdateRoleDto) {
    const role = await this.rolesRepository.findById(roleId);

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (dto.name && dto.name !== role.name) {
      // For name changes, we don't check for duplicates by name since name isn't unique
      // Slug is the unique identifier
    }

    if (dto.permissionIds !== undefined) {
      await this.rolesPolicy.preventModifyingSystemRolePermissions(roleId);
      await this.rolesRepository.setPermissions(roleId, dto.permissionIds);
    }

    const updatedRole = await this.rolesRepository.update(roleId, {
      ...(dto.name && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
    });

    return RoleResponseMapper.toResponse(updatedRole);
  }
}
