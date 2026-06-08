import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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
      const existingRole = await this.rolesRepository.findByName(dto.name);
      if (existingRole) {
        throw new ConflictException('Role name already in use');
      }
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
