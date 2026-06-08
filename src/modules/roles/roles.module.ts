import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { RolesRepository } from './repositories/roles.repository';
import { RolesPolicy } from './policies/roles.policy';
import {
  CreateRoleUseCase,
  ListRolesUseCase,
  GetRoleByIdUseCase,
  UpdateRoleUseCase,
  DeleteRoleUseCase,
  UpdateRolePermissionsUseCase,
  DuplicateRoleUseCase,
} from './use-cases';

@Module({
  controllers: [RolesController],
  providers: [
    // Repository
    RolesRepository,
    // Policy
    RolesPolicy,
    // Use Cases
    CreateRoleUseCase,
    ListRolesUseCase,
    GetRoleByIdUseCase,
    UpdateRoleUseCase,
    DeleteRoleUseCase,
    UpdateRolePermissionsUseCase,
    DuplicateRoleUseCase,
  ],
  exports: [RolesRepository],
})
export class RolesModule {}
