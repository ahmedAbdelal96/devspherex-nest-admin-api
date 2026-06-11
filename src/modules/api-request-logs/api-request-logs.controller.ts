/**
 * API Request Logs Controller
 *
 * Admin read endpoints for request observability logs.
 * Protected by api-request-logs.read permission.
 */

import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Permissions } from '../../common/rbac';
import { SYSTEM_PERMISSION_KEYS } from '../../common/rbac/system-permissions';
import { ListApiRequestLogsQueryDto } from './dto/list-api-request-logs-query.dto';
import { ListApiRequestLogsUseCase } from './use-cases/list-api-request-logs.use-case';
import { GetApiRequestLogUseCase } from './use-cases/get-api-request-log.use-case';
import { toApiRequestLogResponse } from './mappers/api-request-log-response.mapper';

@Controller('api-request-logs')
export class ApiRequestLogsController {
  constructor(
    private readonly listApiRequestLogsUseCase: ListApiRequestLogsUseCase,
    private readonly getApiRequestLogUseCase: GetApiRequestLogUseCase,
  ) {}

  @Get()
  @Permissions(SYSTEM_PERMISSION_KEYS.API_REQUEST_LOGS.READ)
  async list(@Query() query: ListApiRequestLogsQueryDto) {
    const result = await this.listApiRequestLogsUseCase.execute(query);
    return {
      items: result.items.map(toApiRequestLogResponse),
      pagination: result.pagination,
    };
  }

  @Get(':id')
  @Permissions(SYSTEM_PERMISSION_KEYS.API_REQUEST_LOGS.READ)
  async getOne(@Param('id', ParseUUIDPipe) id: string) {
    const log = await this.getApiRequestLogUseCase.execute(id);
    return toApiRequestLogResponse(log);
  }
}