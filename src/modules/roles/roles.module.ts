import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { RolesRepository } from './repositories/roles.repository';
import { RolesPolicy } from './policies/roles.policy';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
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
  imports: [AuditLogsModule],
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
