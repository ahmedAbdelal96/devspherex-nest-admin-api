import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersRepository } from './repositories/users.repository';
import { UsersPolicy } from './policies/users.policy';
import { PasswordService } from '../auth/services/password.service';
import {
  CreateUserUseCase,
  ListUsersUseCase,
  GetUserByIdUseCase,
  UpdateUserUseCase,
  DeleteUserUseCase,
  UpdateUserStatusUseCase,
  UpdateUserRoleUseCase,
  GetUserEffectivePermissionsUseCase,
  UpdateUserPermissionOverridesUseCase,
} from './use-cases';

@Module({
  controllers: [UsersController],
  providers: [
    // Repository
    UsersRepository,
    // Policy
    UsersPolicy,
    // Services (from auth module)
    PasswordService,
    // Use Cases
    CreateUserUseCase,
    ListUsersUseCase,
    GetUserByIdUseCase,
    UpdateUserUseCase,
    DeleteUserUseCase,
    UpdateUserStatusUseCase,
    UpdateUserRoleUseCase,
    GetUserEffectivePermissionsUseCase,
    UpdateUserPermissionOverridesUseCase,
  ],
  exports: [UsersRepository],
})
export class UsersModule {}
