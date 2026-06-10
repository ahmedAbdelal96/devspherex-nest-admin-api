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
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Permissions } from '../../common/rbac';
import { SYSTEM_PERMISSION_KEYS } from '../../common/rbac';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditLogService } from '../audit-logs/services/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '../audit-logs/constants';
import { getAuditRequestContext, getAuditActorFromUser } from '../audit-logs/utils';
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
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post()
  @Permissions(SYSTEM_PERMISSION_KEYS.ROLES.CREATE)
  async create(
    @Body() dto: CreateRoleDto,
    @CurrentUser() currentUser: { id: string; email?: string; roleId?: string },
    @Req() req: Request,
  ): Promise<CreateRoleResponseDto> {
    const result = await this.createRoleUseCase.execute(dto);
    await this.auditLogService.log({
      action: AUDIT_ACTIONS.ROLES_CREATE,
      resourceType: AUDIT_RESOURCE_TYPES.ROLE,
      resourceId: result.id,
      status: 'SUCCESS',
      actor: getAuditActorFromUser(currentUser),
      request: getAuditRequestContext(req),
      after: { id: result.id, name: result.name, slug: result.slug },
    });
    return result;
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
    @CurrentUser('id') currentUserId: string,
    @Req() req: Request,
  ) {
    const result = await this.updateRoleUseCase.execute(id, dto);
    await this.auditLogService.log({
      action: AUDIT_ACTIONS.ROLES_UPDATE,
      resourceType: AUDIT_RESOURCE_TYPES.ROLE,
      resourceId: id,
      status: 'SUCCESS',
      actor: { id: currentUserId },
      request: getAuditRequestContext(req),
      after: dto,
    });
    return result;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(SYSTEM_PERMISSION_KEYS.ROLES.DELETE)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') currentUserId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.deleteRoleUseCase.execute(id);
    await this.auditLogService.log({
      action: AUDIT_ACTIONS.ROLES_DELETE,
      resourceType: AUDIT_RESOURCE_TYPES.ROLE,
      resourceId: id,
      status: 'SUCCESS',
      actor: { id: currentUserId },
      request: getAuditRequestContext(req),
    });
  }

  @Put(':id/permissions')
  @Permissions(SYSTEM_PERMISSION_KEYS.ROLES.PERMISSIONS_UPDATE)
  async updatePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser('id') currentUserId: string,
    @Req() req: Request,
  ) {
    const result = await this.updateRolePermissionsUseCase.execute(id, dto);
    await this.auditLogService.log({
      action: AUDIT_ACTIONS.ROLES_UPDATE_PERMISSIONS,
      resourceType: AUDIT_RESOURCE_TYPES.ROLE,
      resourceId: id,
      status: 'SUCCESS',
      actor: { id: currentUserId },
      request: getAuditRequestContext(req),
      after: { permissionIds: dto.permissionIds },
    });
    return result;
  }

  @Post(':id/duplicate')
  @Permissions(SYSTEM_PERMISSION_KEYS.ROLES.DUPLICATE)
  async duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DuplicateRoleDto,
    @CurrentUser() currentUser: { id: string; email?: string; roleId?: string },
    @Req() req: Request,
  ): Promise<CreateRoleResponseDto> {
    const result = await this.duplicateRoleUseCase.execute(id, dto);
    await this.auditLogService.log({
      action: AUDIT_ACTIONS.ROLES_DUPLICATE,
      resourceType: AUDIT_RESOURCE_TYPES.ROLE,
      resourceId: result.id,
      status: 'SUCCESS',
      actor: getAuditActorFromUser(currentUser),
      request: getAuditRequestContext(req),
      after: { id: result.id, name: result.name, slug: result.slug },
    });
    return result;
  }
}