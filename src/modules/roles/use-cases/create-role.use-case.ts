import { Injectable, ConflictException } from '@nestjs/common';
import { RolesRepository } from '../repositories/roles.repository';
import { CreateRoleDto, CreateRoleResponseDto } from '../dto/create-role.dto';
import { RoleResponseMapper } from '../mappers/role-response.mapper';

@Injectable()
export class CreateRoleUseCase {
  constructor(private readonly rolesRepository: RolesRepository) {}

  async execute(dto: CreateRoleDto): Promise<CreateRoleResponseDto> {
    const existingRole = await this.rolesRepository.findBySlug(dto.slug);

    if (existingRole) {
      throw new ConflictException('Role with this slug already exists');
    }

    const role = await this.rolesRepository.create({
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      permissionIds: dto.permissionIds,
    });

    return RoleResponseMapper.toResponse(role);
  }
}
