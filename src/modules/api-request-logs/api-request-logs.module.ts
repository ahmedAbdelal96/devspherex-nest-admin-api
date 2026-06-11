/**
 * API Request Logs Module
 *
 * Provides request observability logging infrastructure.
 * Registers ApiRequestObservabilityInterceptor globally.
 */

import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ApiRequestLogService } from './services/api-request-log.service';
import { ApiRequestLogsRepository } from './repositories/api-request-logs.repository';
import { ApiRequestObservabilityInterceptor } from './interceptors/api-request-observability.interceptor';
import { ListApiRequestLogsUseCase } from './use-cases/list-api-request-logs.use-case';
import { GetApiRequestLogUseCase } from './use-cases/get-api-request-log.use-case';
import { ApiRequestLogsController } from './api-request-logs.controller';

@Module({
  providers: [
    ApiRequestLogService,
    ApiRequestLogsRepository,
    ListApiRequestLogsUseCase,
    GetApiRequestLogUseCase,
    ApiRequestLogsController,
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiRequestObservabilityInterceptor,
    },
  ],
  exports: [ApiRequestLogService],
})
export class ApiRequestLogsModule {}