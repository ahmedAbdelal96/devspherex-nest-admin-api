import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Permissions } from '../../common/rbac';
import { SYSTEM_PERMISSION_KEYS } from '../../common/rbac';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditLogService } from '../audit-logs/services/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '../audit-logs/constants';
import {
  CreateUserDto,
  ListUsersQueryDto,
  UpdateUserDto,
  UpdateUserStatusDto,
  UpdateUserRoleDto,
  UpdateUserPermissionOverridesDto,
  PaginatedUsersResponseDto,
  CreateUserResponseDto,
} from './dto';
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

@Controller('users')
export class UsersController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly getUserByIdUseCase: GetUserByIdUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly deleteUserUseCase: DeleteUserUseCase,
    private readonly updateUserStatusUseCase: UpdateUserStatusUseCase,
    private readonly updateUserRoleUseCase: UpdateUserRoleUseCase,
    private readonly getUserEffectivePermissionsUseCase: GetUserEffectivePermissionsUseCase,
    private readonly updateUserPermissionOverridesUseCase: UpdateUserPermissionOverridesUseCase,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post()
  @Permissions(SYSTEM_PERMISSION_KEYS.USERS.CREATE)
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() currentUser: { id: string; email?: string },
  ): Promise<CreateUserResponseDto> {
    const result = await this.createUserUseCase.execute(dto);
    await this.auditLogService.log({
      action: AUDIT_ACTIONS.USERS_CREATE,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: result.id,
      status: 'SUCCESS',
      actor: { id: currentUser.id, email: currentUser.email },
      after: { id: result.id, email: result.email, name: result.name },
    });
    return result;
  }

  @Get()
  @Permissions(SYSTEM_PERMISSION_KEYS.USERS.READ)
  async list(@Query() query: ListUsersQueryDto): Promise<PaginatedUsersResponseDto> {
    return this.listUsersUseCase.execute(query);
  }

  @Get(':id')
  @Permissions(SYSTEM_PERMISSION_KEYS.USERS.READ)
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.getUserByIdUseCase.execute(id);
  }

  @Put(':id')
  @Permissions(SYSTEM_PERMISSION_KEYS.USERS.UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.updateUserUseCase.execute(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(SYSTEM_PERMISSION_KEYS.USERS.DELETE)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') currentUserId: string,
  ): Promise<void> {
    await this.deleteUserUseCase.execute(id, currentUserId);
  }

  @Put(':id/status')
  @Permissions(SYSTEM_PERMISSION_KEYS.USERS.STATUS_UPDATE)
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser('id') currentUserId: string,
  ) {
    const result = await this.updateUserStatusUseCase.execute(id, dto, currentUserId);
    await this.auditLogService.log({
      action: AUDIT_ACTIONS.USERS_UPDATE_STATUS,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: id,
      status: 'SUCCESS',
      actor: { id: currentUserId },
      after: { status: dto.status },
    });
    return result;
  }

  @Put(':id/role')
  @Permissions(SYSTEM_PERMISSION_KEYS.USERS.ROLE_UPDATE)
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser('id') currentUserId: string,
  ) {
    const result = await this.updateUserRoleUseCase.execute(id, dto, currentUserId);
    await this.auditLogService.log({
      action: AUDIT_ACTIONS.USERS_UPDATE_ROLE,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: id,
      status: 'SUCCESS',
      actor: { id: currentUserId },
      after: { roleId: dto.roleId },
    });
    return result;
  }

  @Get(':id/effective-permissions')
  @Permissions(SYSTEM_PERMISSION_KEYS.USERS.PERMISSIONS_READ)
  async getEffectivePermissions(@Param('id', ParseUUIDPipe) id: string) {
    return this.getUserEffectivePermissionsUseCase.execute(id);
  }

  @Put(':id/permission-overrides')
  @Permissions(SYSTEM_PERMISSION_KEYS.USERS.PERMISSIONS_OVERRIDE)
  async updatePermissionOverrides(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserPermissionOverridesDto,
    @CurrentUser('id') currentUserId: string,
  ): Promise<{ message: string }> {
    const result = await this.updateUserPermissionOverridesUseCase.execute(id, dto.permissionIds);
    await this.auditLogService.log({
      action: AUDIT_ACTIONS.USERS_PERMISSIONS_OVERRIDE,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: id,
      status: 'SUCCESS',
      actor: { id: currentUserId },
      after: { permissionOverrides: dto.permissionIds },
    });
    return result;
  }
}
