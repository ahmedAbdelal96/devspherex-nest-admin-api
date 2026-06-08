import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { UsersRepository } from '../repositories/users.repository';
import { UsersPolicy } from '../policies/users.policy';

@Injectable()
export class DeleteUserUseCase {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly usersPolicy: UsersPolicy,
  ) {}

  async execute(userId: string, currentUserId: string): Promise<void> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (userId === currentUserId) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    await this.usersPolicy.preventDeletingLastSuperAdmin();

    await this.usersRepository.delete(userId);
  }
}
