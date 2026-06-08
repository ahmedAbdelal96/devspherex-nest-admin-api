import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { RolesRepository } from '../repositories/roles.repository';
import { DuplicateRoleDto, CreateRoleResponseDto } from '../dto';
import { RoleResponseMapper } from '../mappers/role-response.mapper';

@Injectable()
export class DuplicateRoleUseCase {
  constructor(private readonly rolesRepository: RolesRepository) {}

  async execute(sourceRoleId: string, dto: DuplicateRoleDto): Promise<CreateRoleResponseDto> {
    const sourceRole = await this.rolesRepository.findById(sourceRoleId);

    if (!sourceRole) {
      throw new NotFoundException('Source role not found');
    }

    const existingRole = await this.rolesRepository.findByName(dto.name);
    if (existingRole) {
      throw new ConflictException('Role with this name already exists');
    }

    const permissionIds = sourceRole.permissions.map((rp) => rp.permission.id);

    const newRole = await this.rolesRepository.create({
      name: dto.name,
      description: sourceRole.description
        ? `Duplicate of ${sourceRole.name}`
 : undefined,
      permissionIds,
    });

    return RoleResponseMapper.toResponse(newRole);
  }
}
