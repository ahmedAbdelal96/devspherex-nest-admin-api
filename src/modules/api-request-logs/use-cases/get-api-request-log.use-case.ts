/**
 * Get API Request Log Use Case
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { ApiRequestLogsRepository } from '../repositories/api-request-logs.repository';

@Injectable()
export class GetApiRequestLogUseCase {
  constructor(private readonly apiRequestLogsRepository: ApiRequestLogsRepository) {}

  async execute(id: string) {
    const log = await this.apiRequestLogsRepository.findById(id);
    if (!log) {
      throw new NotFoundException(`API request log with ID "${id}" not found`);
    }
    return log;
  }
}