import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
 HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ListAuditLogsQueryDto, ListAuditLogsResponseDto, CreateAuditLogDto } from './dto';
import { ListAuditLogsUseCase, CreateAuditLogUseCase } from './use-cases';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditLogsController {
  constructor(
    private readonly listAuditLogsUseCase: ListAuditLogsUseCase,
    private readonly createAuditLogUseCase: CreateAuditLogUseCase,
  ) {}

  @Get()
  async list(@Query() query: ListAuditLogsQueryDto): Promise<ListAuditLogsResponseDto> {
    return this.listAuditLogsUseCase.execute(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateAuditLogDto) {
    return this.createAuditLogUseCase.execute(dto);
  }
}
