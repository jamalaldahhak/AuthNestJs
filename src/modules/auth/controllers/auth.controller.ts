import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { LoginDto } from '../dtos/login.dto.js';
import { CheckAuthorizationDto } from '../dtos/check-authorization.dto.js';
import { RefreshTokenDto } from '../dtos/refresh-token.dto.js';
import { RegisterDto } from '../dtos/register.dto.js';
import { AccessTokenGuard } from '../guards/access-token.guard.js';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface.js';
import { AuthService } from '../services/auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('login-options')
  getLoginOptions() {
    return this.authService.getLoginOptions();
  }

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(
    @Body() dto: LoginDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const userAgent = request.headers['user-agent'];
    return this.authService.login(
      dto,
      request.ip,
      Array.isArray(userAgent) ? userAgent.join(' ') : userAgent,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  getProfile(@Req() request: AuthenticatedRequest) {
    return this.authService.getProfile(request.authUser!.id);
  }

  @Post('authorization/check')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  checkAuthorization(
    @Body() dto: CheckAuthorizationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.checkAuthorization(request.authUser!, dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  logout(@Req() request: AuthenticatedRequest) {
    return this.authService.logout(request.authUser!.sessionId);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  logoutAll(@Req() request: AuthenticatedRequest) {
    return this.authService.logoutAll(request.authUser!.id);
  }
}
