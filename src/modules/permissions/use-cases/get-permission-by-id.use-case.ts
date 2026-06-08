import { Injectable, NotFoundException } from '@nestjs/common';
import { PermissionsRepository } from '../repositories/permissions.repository';
import { PermissionResponseMapper } from '../mappers/permission-response.mapper';

@Injectable()
export class GetPermissionByIdUseCase {
  constructor(private readonly permissionsRepository: PermissionsRepository) {}

  async execute(permissionId: string) {
    const permission = await this.permissionsRepository.findById(permissionId);

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    return PermissionResponseMapper.toResponse(permission);
  }
}
