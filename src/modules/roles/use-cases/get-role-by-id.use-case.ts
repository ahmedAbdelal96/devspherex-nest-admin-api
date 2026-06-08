import { Injectable, NotFoundException } from '@nestjs/common';
import { RolesRepository } from '../repositories/roles.repository';
import { RoleResponseMapper } from '../mappers/role-response.mapper';

@Injectable()
export class GetRoleByIdUseCase {
  constructor(private readonly rolesRepository: RolesRepository) {}

  async execute(roleId: string) {
    const role = await this.rolesRepository.findById(roleId);

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return RoleResponseMapper.toResponse(role);
  }
}
