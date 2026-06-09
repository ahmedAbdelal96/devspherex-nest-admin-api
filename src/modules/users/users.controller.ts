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
  ) {}

  @Post()
  @Permissions(SYSTEM_PERMISSION_KEYS.USERS.CREATE)
  async create(@Body() dto: CreateUserDto): Promise<CreateUserResponseDto> {
    return this.createUserUseCase.execute(dto);
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
    return this.updateUserStatusUseCase.execute(id, dto, currentUserId);
  }

  @Put(':id/role')
  @Permissions(SYSTEM_PERMISSION_KEYS.USERS.ROLE_UPDATE)
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.updateUserRoleUseCase.execute(id, dto, currentUserId);
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
  ): Promise<{ message: string }> {
    return this.updateUserPermissionOverridesUseCase.execute(id, dto.permissionIds);
  }
}