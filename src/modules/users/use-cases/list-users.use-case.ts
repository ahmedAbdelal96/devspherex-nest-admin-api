import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../repositories/users.repository';
import { ListUsersQueryDto, PaginatedUsersResponseDto } from '../dto/list-users.dto';
import { UserResponseMapper } from '../mappers/user-response.mapper';

@Injectable()
export class ListUsersUseCase {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute(query: ListUsersQueryDto): Promise<PaginatedUsersResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 10;

    const { data, total } = await this.usersRepository.findAll({
      search: query.search,
      status: query.status,
      roleId: query.roleId,
      page,
      limit,
    });

    return {
      data: UserResponseMapper.toListResponse(data),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
