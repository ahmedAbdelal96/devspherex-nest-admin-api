import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public, Authenticated } from '../../common/rbac';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ChangePasswordDto,
  LogoutDto,
  AuthResponseDto,
  RefreshTokenResponseDto,
} from './dto';
import {
  RequestPasswordRecoveryDto,
  VerifyPasswordRecoveryOtpDto,
  ResetPasswordWithTokenDto,
} from './password-recovery/dto';
import {
  RegisterUseCase,
  LoginUseCase,
  LogoutUseCase,
  LogoutAllUseCase,
  RefreshTokenUseCase,
  GetMeUseCase,
  ChangePasswordUseCase,
} from './use-cases';
import { RequestPasswordRecoveryUseCase } from './password-recovery/use-cases/request-password-recovery.use-case';
import { VerifyPasswordRecoveryOtpUseCase } from './password-recovery/use-cases/verify-password-recovery-otp.use-case';
import { ResetPasswordWithTokenUseCase } from './password-recovery/use-cases/reset-password-with-token.use-case';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly logoutAllUseCase: LogoutAllUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly getMeUseCase: GetMeUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    private readonly requestPasswordRecoveryUseCase: RequestPasswordRecoveryUseCase,
    private readonly verifyPasswordRecoveryOtpUseCase: VerifyPasswordRecoveryOtpUseCase,
    private readonly resetPasswordWithTokenUseCase: ResetPasswordWithTokenUseCase,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.registerUseCase.execute(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.loginUseCase.execute(dto);
  }

  @Authenticated()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser('id') userId: string,
    @Body() dto: LogoutDto,
  ): Promise<{ message: string }> {
    await this.logoutUseCase.execute(userId, dto.refreshToken);
    return { message: 'Logged out successfully' };
  }

  @Authenticated()
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@CurrentUser('id') userId: string): Promise<{ message: string }> {
    await this.logoutAllUseCase.execute(userId);
    return { message: 'Logged out from all devices successfully' };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto): Promise<RefreshTokenResponseDto> {
    return this.refreshTokenUseCase.execute(dto.refreshToken);
  }

  @Authenticated()
  @Get('me')
  async getMe(@CurrentUser('id') userId: string) {
    return this.getMeUseCase.execute(userId);
  }

  @Authenticated()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.changePasswordUseCase.execute(userId, dto);
    return { message: 'Password changed successfully' };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() dto: RequestPasswordRecoveryDto,
    @Req() req: Request,
  ): Promise<{ message: string; devOtp?: string }> {
    const requestIp =
      (req.ip as string | undefined) ??
      (req.socket as { remoteAddress?: string } | undefined)?.remoteAddress;
    const userAgentRaw = req.headers['user-agent'];
    const userAgent = Array.isArray(userAgentRaw)
      ? userAgentRaw[0]
      : (userAgentRaw as string | undefined);

    // The use-case returns the exact response. The response shape is:
    //   { message: string, devOtp?: string }
    //
    // `devOtp` is included ONLY when:
    //   - NODE_ENV/app.env is not production, AND
    //   - PASSWORD_RECOVERY_DEV_RETURN_OTP=true, AND
    //   - a real OTP was actually generated (known email, not in cooldown).
    //
    // The use-case never includes `devOtp` in production, never for
    // unknown-email markers, and never when cooldown blocks a new OTP.
    return this.requestPasswordRecoveryUseCase.execute(dto.email, {
      requestIp,
      userAgent,
    });
  }

  @Public()
  @Post('verify-password-recovery-otp')
  @HttpCode(HttpStatus.OK)
  async verifyPasswordRecoveryOtp(
    @Body() dto: VerifyPasswordRecoveryOtpDto,
  ): Promise<{ resetSessionToken: string; expiresIn: number }> {
    return this.verifyPasswordRecoveryOtpUseCase.execute(dto.email, dto.otp);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordWithTokenDto,
  ): Promise<{ message: string }> {
    return this.resetPasswordWithTokenUseCase.execute(
      dto.resetSessionToken,
      dto.newPassword,
    );
  }
}
