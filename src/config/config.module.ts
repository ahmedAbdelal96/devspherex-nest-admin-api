import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  databaseConfig,
  jwtConfig,
  appConfig,
  passwordRecoveryConfig,
} from './configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, appConfig, passwordRecoveryConfig],
      envFilePath: ['.env.local', '.env'],
    }),
  ],
})
export class AppConfigModule {}
