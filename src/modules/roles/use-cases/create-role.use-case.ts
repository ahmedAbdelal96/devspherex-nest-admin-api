import { Injectable, ConflictException } from '@nestjs/common';
import { RolesRepository } from '../repositories/roles.repository';
import { CreateRoleDto, CreateRoleResponseDto } from '../dto/create-role.dto';
import { RoleResponseMapper } from '../mappers/role-response.mapper';

@Injectable()
export class CreateRoleUseCase {
  constructor(private readonly rolesRepository: RolesRepository) {}

  async execute(dto: CreateRoleDto): Promise<CreateRoleResponseDto> {
    const existingRole = await this.rolesRepository.findByName(dto.name);

    if (existingRole) {
      throw new ConflictException('Role with this name already exists');
    }

    const role = await this.rolesRepository.create({
      name: dto.name,
      description: dto.description,
      permissionIds: dto.permissionIds,
    });

    return RoleResponseMapper.toResponse(role);
  }
}
