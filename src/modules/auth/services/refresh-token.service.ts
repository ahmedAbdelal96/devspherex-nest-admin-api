import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';

@Injectable()
export class RefreshTokenService {
  private readonly SALT_ROUNDS = 12;

  constructor(private readonly configService: ConfigService) {}

  async generateRefreshToken(): Promise<string> {
    const token = uuidv4();
    return bcrypt.hash(token, this.SALT_ROUNDS);
  }

  async verifyRefreshToken(token: string, hashedToken: string): Promise<boolean> {
    return bcrypt.compare(token, hashedToken);
  }

  getRefreshTokenExpiry(): Date {
    const expiresIn = this.configService.get('jwt.refreshExpiresIn') as string;
    const match = expiresIn.match(/^(\d+)([mhd])$/);

    if (!match) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // default 7 days
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];
    const now = new Date();

    switch (unit) {
      case 'm':
        return new Date(now.getTime() + value * 60 * 1000);
      case 'h':
        return new Date(now.getTime() + value * 3600 * 1000);
      case 'd':
        return new Date(now.getTime() + value * 24 * 3600 * 1000);
      default:
        return new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    }
  }
}
