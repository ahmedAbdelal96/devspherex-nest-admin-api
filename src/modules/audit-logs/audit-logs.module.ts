import { Module } from '@nestjs/common';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsRepository } from './repositories/audit-logs.repository';
import { AuditLogService } from './services/audit-log.service';
import {
  ListAuditLogsUseCase,
  GetAuditLogUseCase,
  CreateAuditLogUseCase,
} from './use-cases';

@Module({
  controllers: [AuditLogsController],
  providers: [
    // Repository
    AuditLogsRepository,
    // Services
    AuditLogService,
    // Use Cases
    ListAuditLogsUseCase,
    GetAuditLogUseCase,
    CreateAuditLogUseCase,
  ],
  exports: [AuditLogsRepository, AuditLogService],
})
export class AuditLogsModule {}
