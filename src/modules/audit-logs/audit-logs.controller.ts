import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Permissions } from '../../common/rbac';
import { SYSTEM_PERMISSION_KEYS } from '../../common/rbac';
import { ListAuditLogsQueryDto } from './dto';
import {
  ListAuditLogsUseCase,
  GetAuditLogUseCase,
  CreateAuditLogUseCase,
} from './use-cases';
import type { ListAuditLogsResponseDto } from './use-cases/list-audit-logs.use-case';
import {
  ApiListAuditLogsDocs,
  ApiGetAuditLogDocs,
  ApiCreateAuditLogDocs,
} from './swagger/audit-logs.swagger';

@Controller('audit-logs')
export class AuditLogsController {
  constructor(
    private readonly listAuditLogsUseCase: ListAuditLogsUseCase,
    private readonly getAuditLogUseCase: GetAuditLogUseCase,
    private readonly createAuditLogUseCase: CreateAuditLogUseCase,
  ) {}

  @Get()
  @Permissions(SYSTEM_PERMISSION_KEYS.AUDIT_LOGS.READ)
  @ApiListAuditLogsDocs()
  async list(@Query() query: ListAuditLogsQueryDto): Promise<ListAuditLogsResponseDto> {
    return this.listAuditLogsUseCase.execute(query);
  }

  @Get(':id')
  @Permissions(SYSTEM_PERMISSION_KEYS.AUDIT_LOGS.READ)
  @ApiGetAuditLogDocs()
  async getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.getAuditLogUseCase.execute(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(SYSTEM_PERMISSION_KEYS.AUDIT_LOGS.CREATE)
  @ApiCreateAuditLogDocs()
  async create(@Body() dto: unknown) {
    return this.createAuditLogUseCase.execute(dto as never);
  }
}
