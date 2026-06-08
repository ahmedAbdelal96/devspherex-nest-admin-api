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
@UseGuards(JwtAuthGuard)
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
  async create(@Body() dto: CreateRoleDto): Promise<CreateRoleResponseDto> {
    return this.createRoleUseCase.execute(dto);
  }

  @Get()
  async list(@Query() query: ListRolesQueryDto): Promise<PaginatedRolesResponseDto> {
    return this.listRolesUseCase.execute(query);
  }

  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.getRoleByIdUseCase.execute(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.updateRoleUseCase.execute(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.deleteRoleUseCase.execute(id);
  }

  @Put(':id/permissions')
  async updatePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.updateRolePermissionsUseCase.execute(id, dto);
  }

  @Post(':id/duplicate')
  async duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DuplicateRoleDto,
  ): Promise<CreateRoleResponseDto> {
    return this.duplicateRoleUseCase.execute(id, dto);
  }
}
