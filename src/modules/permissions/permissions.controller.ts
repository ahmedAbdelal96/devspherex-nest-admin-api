import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Permissions } from '../../common/rbac';
import { SYSTEM_PERMISSION_KEYS } from '../../common/rbac';
import {
  ListPermissionsQueryDto,
  ListPermissionsResponseDto,
  ListGroupedPermissionsResponseDto,
} from './dto';
import {
  ListPermissionsUseCase,
  ListGroupedPermissionsUseCase,
  GetPermissionByIdUseCase,
} from './use-cases';

@Controller('permissions')
export class PermissionsController {
  constructor(
    private readonly listPermissionsUseCase: ListPermissionsUseCase,
    private readonly listGroupedPermissionsUseCase: ListGroupedPermissionsUseCase,
    private readonly getPermissionByIdUseCase: GetPermissionByIdUseCase,
  ) {}

  @Get()
  @Permissions(SYSTEM_PERMISSION_KEYS.PERMISSIONS.READ)
  async list(@Query() query: ListPermissionsQueryDto): Promise<ListPermissionsResponseDto> {
    return this.listPermissionsUseCase.execute(query);
  }

  @Get('grouped')
  @Permissions(SYSTEM_PERMISSION_KEYS.PERMISSIONS.GROUPED_READ)
  async listGrouped(): Promise<ListGroupedPermissionsResponseDto> {
    return this.listGroupedPermissionsUseCase.execute();
  }

  @Get(':id')
  @Permissions(SYSTEM_PERMISSION_KEYS.PERMISSIONS.READ)
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.getPermissionByIdUseCase.execute(id);
  }
}