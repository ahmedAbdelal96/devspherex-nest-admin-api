import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Permissions } from '../../common/rbac';
import { SYSTEM_PERMISSION_KEYS } from '../../common/rbac';
import { ListAuditLogsQueryDto, ListAuditLogsResponseDto, CreateAuditLogDto } from './dto';
import { ListAuditLogsUseCase, CreateAuditLogUseCase } from './use-cases';

@Controller('audit-logs')
export class AuditLogsController {
  constructor(
    private readonly listAuditLogsUseCase: ListAuditLogsUseCase,
    private readonly createAuditLogUseCase: CreateAuditLogUseCase,
  ) {}

  @Get()
  @Permissions(SYSTEM_PERMISSION_KEYS.AUDIT_LOGS.READ)
  async list(@Query() query: ListAuditLogsQueryDto): Promise<ListAuditLogsResponseDto> {
    return this.listAuditLogsUseCase.execute(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(SYSTEM_PERMISSION_KEYS.AUDIT_LOGS.CREATE)
  async create(@Body() dto: CreateAuditLogDto) {
    return this.createAuditLogUseCase.execute(dto);
  }
}