import { Module } from '@nestjs/common';
import { PermissionsController } from './permissions.controller';
import { PermissionsRepository } from './repositories/permissions.repository';
import { EffectivePermissionsService } from './services/effective-permissions.service';
import {
  ListPermissionsUseCase,
  ListGroupedPermissionsUseCase,
  GetPermissionByIdUseCase,
} from './use-cases';

@Module({
  controllers: [PermissionsController],
  providers: [
    // Repository
    PermissionsRepository,
    // Services
    EffectivePermissionsService,
    // Use Cases
    ListPermissionsUseCase,
    ListGroupedPermissionsUseCase,
    GetPermissionByIdUseCase,
  ],
  exports: [PermissionsRepository, EffectivePermissionsService],
})
export class PermissionsModule {}
