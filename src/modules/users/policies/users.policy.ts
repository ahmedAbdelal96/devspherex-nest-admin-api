import { Injectable, ForbiddenException } from '@nestjs/common';
import { UsersRepository } from '../repositories/users.repository';

@Injectable()
export class UsersPolicy {
  constructor(private readonly usersRepository: UsersRepository) {}

  /**
   * Prevent deleting the last Super Admin user
   */
  async preventDeletingLastSuperAdmin(): Promise<void> {
    // TODO: Implement when roles are integrated
    // Check if this is the last super admin
 // const superAdminRole = await this.rolesRepository.findByName('Super Admin');
    // if (superAdminRole) {
    //   const superAdminCount = await this.prisma.user.count({
    //     where: { roleId: superAdminRole.id },
    //   });
    //   if (superAdminCount <= 1) {
    //     throw new ForbiddenException('Cannot delete the last Super Admin');
    //   }
    // }
  }

  /**
   * Prevent unsafe role changes - users cannot elevate their own permissions
   */
  async preventUnsafeRoleChange(
    targetUserId: string,
    currentUserId: string,
    newRoleId: string,
  ): Promise<void> {
    if (targetUserId === currentUserId) {
      throw new ForbiddenException('Cannot change your own role');
    }
  }

  /**
   * Prevent deactivating yourself
   */
  async preventDeactivatingSelf(userId: string, targetUserId: string): Promise<void> {
    if (userId === targetUserId) {
      throw new ForbiddenException('Cannot deactivate your own account');
    }
  }

  /**
   * Check if user can modify target user
   */
  async canModifyUser(currentUserId: string, targetUserId: string): Promise<boolean> {
    // TODO: Implement proper authorization based on roles/permissions
    // For now, allow all authenticated users to modify others
    return currentUserId !== targetUserId;
  }
}
