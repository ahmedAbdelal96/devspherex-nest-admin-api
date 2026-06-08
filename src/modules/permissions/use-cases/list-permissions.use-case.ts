import { Injectable } from '@nestjs/common';
import { PermissionsRepository } from '../repositories/permissions.repository';
import { ListPermissionsQueryDto, ListPermissionsResponseDto } from '../dto/list-permissions.dto';
import { PermissionResponseMapper } from '../mappers/permission-response.mapper';

@Injectable()
export class ListPermissionsUseCase {
  constructor(private readonly permissionsRepository: PermissionsRepository) {}

  async execute(query: ListPermissionsQueryDto): Promise<ListPermissionsResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 50;

    const { data, total } = await this.permissionsRepository.findAll({
      search: query.search,
      groupName: query.groupName,
      page,
      limit,
    });

    return {
      data: PermissionResponseMapper.toListResponse(data),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
