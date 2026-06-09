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
import {
  CreateRoleDto,
  ListRolesQueryDto,
  UpdateRoleDto,
  UpdateRolePermissionsDto,
  DuplicateRoleDto,
  PaginatedRolesResponseDto,
  CreateRoleResponseDto,
} from './dto';
import {
  CreateRoleUseCase,
  ListRolesUseCase,
  GetRoleByIdUseCase,
  UpdateRoleUseCase,
  DeleteRoleUseCase,
  UpdateRolePermissionsUseCase,
  DuplicateRoleUseCase,
} from './use-cases';

@Controller('roles')
export class RolesController {
  constructor(
    private readonly createRoleUseCase: CreateRoleUseCase,
    private readonly listRolesUseCase: ListRolesUseCase,
    private readonly getRoleByIdUseCase: GetRoleByIdUseCase,
    private readonly updateRoleUseCase: UpdateRoleUseCase,
    private readonly deleteRoleUseCase: DeleteRoleUseCase,
    private readonly updateRolePermissionsUseCase: UpdateRolePermissionsUseCase,
    private readonly duplicateRoleUseCase: DuplicateRoleUseCase,
  ) {}

  @Post()
  @Permissions(SYSTEM_PERMISSION_KEYS.ROLES.CREATE)
  async create(@Body() dto: CreateRoleDto): Promise<CreateRoleResponseDto> {
    return this.createRoleUseCase.execute(dto);
  }

  @Get()
  @Permissions(SYSTEM_PERMISSION_KEYS.ROLES.READ)
  async list(@Query() query: ListRolesQueryDto): Promise<PaginatedRolesResponseDto> {
    return this.listRolesUseCase.execute(query);
  }

  @Get(':id')
  @Permissions(SYSTEM_PERMISSION_KEYS.ROLES.READ)
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.getRoleByIdUseCase.execute(id);
  }

  @Put(':id')
  @Permissions(SYSTEM_PERMISSION_KEYS.ROLES.UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.updateRoleUseCase.execute(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(SYSTEM_PERMISSION_KEYS.ROLES.DELETE)
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.deleteRoleUseCase.execute(id);
  }

  @Put(':id/permissions')
  @Permissions(SYSTEM_PERMISSION_KEYS.ROLES.PERMISSIONS_UPDATE)
  async updatePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.updateRolePermissionsUseCase.execute(id, dto);
  }

  @Post(':id/duplicate')
  @Permissions(SYSTEM_PERMISSION_KEYS.ROLES.DUPLICATE)
  async duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DuplicateRoleDto,
  ): Promise<CreateRoleResponseDto> {
    return this.duplicateRoleUseCase.execute(id, dto);
  }
}