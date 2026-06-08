import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
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
@UseGuards(JwtAuthGuard)
export class PermissionsController {
  constructor(
    private readonly listPermissionsUseCase: ListPermissionsUseCase,
    private readonly listGroupedPermissionsUseCase: ListGroupedPermissionsUseCase,
    private readonly getPermissionByIdUseCase: GetPermissionByIdUseCase,
  ) {}

  @Get()
  async list(@Query() query: ListPermissionsQueryDto): Promise<ListPermissionsResponseDto> {
    return this.listPermissionsUseCase.execute(query);
  }

  @Get('grouped')
  async listGrouped(): Promise<ListGroupedPermissionsResponseDto> {
    return this.listGroupedPermissionsUseCase.execute();
  }

  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.getPermissionByIdUseCase.execute(id);
  }
}
