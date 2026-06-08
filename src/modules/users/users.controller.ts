import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
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
@UseGuards(JwtAuthGuard)
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
  async create(@Body() dto: CreateUserDto): Promise<CreateUserResponseDto> {
    return this.createUserUseCase.execute(dto);
  }

  @Get()
  async list(@Query() query: ListUsersQueryDto): Promise<PaginatedUsersResponseDto> {
    return this.listUsersUseCase.execute(query);
  }

  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.getUserByIdUseCase.execute(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.updateUserUseCase.execute(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') currentUserId: string,
  ): Promise<void> {
    await this.deleteUserUseCase.execute(id, currentUserId);
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.updateUserStatusUseCase.execute(id, dto, currentUserId);
  }

  @Put(':id/role')
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.updateUserRoleUseCase.execute(id, dto, currentUserId);
  }

  @Get(':id/effective-permissions')
  async getEffectivePermissions(@Param('id', ParseUUIDPipe) id: string) {
    return this.getUserEffectivePermissionsUseCase.execute(id);
  }

  @Put(':id/permission-overrides')
  async updatePermissionOverrides(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserPermissionOverridesDto,
  ): Promise<{ message: string }> {
    return this.updateUserPermissionOverridesUseCase.execute(id, dto.permissionIds);
  }
}
