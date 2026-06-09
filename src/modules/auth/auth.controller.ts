import {
  Controller,
  Post,
  Body,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Public, Authenticated } from '../../common/rbac';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  LogoutDto,
  AuthResponseDto,
  RefreshTokenResponseDto,
} from './dto';
import {
  RegisterUseCase,
  LoginUseCase,
  LogoutUseCase,
  LogoutAllUseCase,
  RefreshTokenUseCase,
  GetMeUseCase,
  ChangePasswordUseCase,
  ForgotPasswordUseCase,
  ResetPasswordUseCase,
} from './use-cases';

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
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
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
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    return this.forgotPasswordUseCase.execute(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    return this.resetPasswordUseCase.execute(dto);
  }
}