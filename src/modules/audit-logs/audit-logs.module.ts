import { Module } from '@nestjs/common';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsRepository } from './repositories/audit-logs.repository';
import { ListAuditLogsUseCase, CreateAuditLogUseCase } from './use-cases';

@Module({
  controllers: [AuditLogsController],
  providers: [
    // Repository
    AuditLogsRepository,
    // Use Cases
    ListAuditLogsUseCase,
    CreateAuditLogUseCase,
  ],
  exports: [AuditLogsRepository],
})
export class AuditLogsModule {}
