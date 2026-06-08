import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from '../repositories/users.repository';

@Injectable()
export class UpdateUserPermissionOverridesUseCase {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute(userId: string, permissionIds: string[]): Promise<{ message: string }> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.usersRepository.setPermissionOverrides(userId, permissionIds);

    return { message: 'Permission overrides updated successfully' };
  }
}
