import { Injectable } from '@nestjs/common';
import { RefreshTokensRepository } from '../repositories/refresh-tokens.repository';

@Injectable()
export class LogoutUseCase {
  constructor(private readonly refreshTokensRepository: RefreshTokensRepository) {}

  async execute(refreshToken: string): Promise<void> {
    await this.refreshTokensRepository.revoke(refreshToken);
  }
}
