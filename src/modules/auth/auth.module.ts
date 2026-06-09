import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { RefreshTokensRepository } from './repositories/refresh-tokens.repository';
import {
  RegisterUseCase,
  LoginUseCase,
  LogoutUseCase,
  LogoutAllUseCase,
  RefreshTokenUseCase,
  GetMeUseCase,
  ChangePasswordUseCase,
} from './use-cases';
import { PasswordRecoveryModule } from './password-recovery/password-recovery.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('jwt.secret'),
        signOptions: {
          expiresIn: configService.get('jwt.expiresIn'),
        },
      }),
      inject: [ConfigService],
    }),
    // Password recovery subsystem
    PasswordRecoveryModule,
  ],
  controllers: [AuthController],
  providers: [
    // Strategies
    JwtStrategy,
    // Services
    PasswordService,
    TokenService,
    RefreshTokenService,
    // Repositories
    RefreshTokensRepository,
    // Use Cases
    RegisterUseCase,
    LoginUseCase,
    LogoutUseCase,
    LogoutAllUseCase,
    RefreshTokenUseCase,
    GetMeUseCase,
    ChangePasswordUseCase,
  ],
  exports: [
    PasswordService,
    TokenService,
    RefreshTokenService,
    RefreshTokensRepository,
  ],
})
export class AuthModule {}
