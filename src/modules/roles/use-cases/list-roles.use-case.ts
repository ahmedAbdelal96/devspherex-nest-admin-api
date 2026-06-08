import { Injectable } from '@nestjs/common';
import { RolesRepository } from '../repositories/roles.repository';
import { ListRolesQueryDto, PaginatedRolesResponseDto } from '../dto/list-roles.dto';
import { RoleResponseMapper } from '../mappers/role-response.mapper';

@Injectable()
export class ListRolesUseCase {
  constructor(private readonly rolesRepository: RolesRepository) {}

  async execute(query: ListRolesQueryDto): Promise<PaginatedRolesResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 10;

    const { data, total } = await this.rolesRepository.findAll({
      search: query.search,
      page,
      limit,
    });

    return {
      data: RoleResponseMapper.toListResponse(data),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
