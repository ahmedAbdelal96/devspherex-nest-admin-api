/**
 * Logging Module
 *
 * Provides the centralized Winston-based logging service.
 * Import globally in AppModule for app-wide use.
 */

import { Global, Module } from '@nestjs/common';
import { LoggingService } from './logging.service';

@Global()
@Module({
  providers: [LoggingService],
  exports: [LoggingService],
})
export class LoggingModule {}