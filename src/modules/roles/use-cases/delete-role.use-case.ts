import { Injectable, NotFoundException } from '@nestjs/common';
import { RolesRepository } from '../repositories/roles.repository';
import { RolesPolicy } from '../policies/roles.policy';

@Injectable()
export class DeleteRoleUseCase {
  constructor(
    private readonly rolesRepository: RolesRepository,
    private readonly rolesPolicy: RolesPolicy,
  ) {}

  async execute(roleId: string): Promise<void> {
    const role = await this.rolesRepository.findById(roleId);

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    await this.rolesPolicy.preventDeletingSystemRole(roleId);
    await this.rolesPolicy.preventDeletingRoleWithUsers(roleId);

    await this.rolesRepository.delete(roleId);
  }
}
