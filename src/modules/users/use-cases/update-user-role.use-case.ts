import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { UsersRepository } from '../repositories/users.repository';
import { UsersPolicy } from '../policies/users.policy';
import { UpdateUserRoleDto } from '../dto/update-user-role.dto';
import { UserResponseMapper } from '../mappers/user-response.mapper';

@Injectable()
export class UpdateUserRoleUseCase {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly usersPolicy: UsersPolicy,
  ) {}

  async execute(userId: string, dto: UpdateUserRoleDto, currentUserId: string) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.roleId) {
      await this.usersPolicy.preventUnsafeRoleChange(userId, currentUserId, dto.roleId);
    }

    const updatedUser = await this.usersRepository.updateRole(userId, dto.roleId || null);

    return UserResponseMapper.toResponse(updatedUser);
  }
}
