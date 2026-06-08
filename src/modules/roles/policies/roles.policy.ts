import { Injectable, ForbiddenException } from '@nestjs/common';
import { RolesRepository } from '../repositories/roles.repository';

@Injectable()
export class RolesPolicy {
  constructor(private readonly rolesRepository: RolesRepository) {}

  /**
   * Prevent deleting system roles
   */
  async preventDeletingSystemRole(roleId: string): Promise<void> {
    const role = await this.rolesRepository.findById(roleId);

    if (!role) {
      return; // Let the use case handle not found
    }

    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be deleted');
    }
  }

  /**
   * Prevent modifying system role permissions
   */
  async preventModifyingSystemRolePermissions(roleId: string): Promise<void> {
    const role = await this.rolesRepository.findById(roleId);

    if (!role) {
      return;
    }

    if (role.isSystem) {
      throw new ForbiddenException('System role permissions cannot be modified');
    }
  }

  /**
   * Prevent deleting a role that has assigned users
   */
  async preventDeletingRoleWithUsers(roleId: string): Promise<void> {
    const userCount = await this.rolesRepository.countUsersWithRole(roleId);

    if (userCount > 0) {
      throw new ForbiddenException(
        `Cannot delete role with ${userCount} assigned user(s). Reassign users first.`,
      );
    }
  }
}
