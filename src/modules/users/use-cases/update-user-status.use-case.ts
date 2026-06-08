import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { UsersRepository } from '../repositories/users.repository';
import { UsersPolicy } from '../policies/users.policy';
import { UpdateUserStatusDto } from '../dto/update-user-status.dto';
import { UserResponseMapper } from '../mappers/user-response.mapper';

@Injectable()
export class UpdateUserStatusUseCase {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly usersPolicy: UsersPolicy,
  ) {}

  async execute(userId: string, dto: UpdateUserStatusDto, currentUserId: string) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.usersPolicy.preventDeactivatingSelf(currentUserId, userId);

    const updatedUser = await this.usersRepository.updateStatus(userId, dto.status);

    return UserResponseMapper.toResponse(updatedUser);
  }
}
