import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from '../repositories/users.repository';
import { UserResponseMapper } from '../mappers/user-response.mapper';

@Injectable()
export class GetUserByIdUseCase {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute(userId: string) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Permission key is now stored as 'key' not 'name'
    const rolePermissions = user.role?.permissions.map((rp) => rp.permission.key) || [];

    return UserResponseMapper.toResponseWithPermissions(user, rolePermissions);
  }
}
