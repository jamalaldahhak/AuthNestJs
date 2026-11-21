import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { timingSafeEqual } from 'crypto';

import { UserRepository } from '../../users/repositories/user.repository.js';
import { UserStatus } from '../../users/constants/user-status.enum.js';
import { RoleEntity } from '../../authorization/models/role.entity.js';
import { RoleRepository } from '../../authorization/repositories/role.repository.js';
import { LoginMethod } from '../../authorization/constants/login-method.enum.js';
import { ADMINISTRATIVE_PERMISSION_KEYS } from '../../authorization/constants/administrative-permissions.js';
import { RegisterDto } from '../dtos/register.dto.js';
import { CheckAuthorizationDto } from '../dtos/check-authorization.dto.js';
import { LoginDto } from '../dtos/login.dto.js';
import { RefreshTokenDto } from '../dtos/refresh-token.dto.js';
import { TokenService } from './token.service.js';
import { SessionService } from './session.service.js';
import { AUTH_CONSTANTS } from '../constants/auth.constants.js';
import { AuthSessionRepository } from '../repositories/auth-session.repository.js';
import { SessionStatus } from '../constants/session-status.enum.js';
import { JwtPayload } from '../interfaces/jwt-payload.interface.js';
import { isDuplicateEntry } from '../../../database/is-duplicate-entry.js';
import type { AuthenticatedUser } from '../interfaces/authenticated-request.interface.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly authSessionRepository: AuthSessionRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly roleRepository: RoleRepository,
  ) {}

  async getLoginOptions() {
    const roles = await this.roleRepository.findActiveLoginOptions();

    return roles.map(({ slug, name, loginMethod, selfRegistrationEnabled }) => ({
      slug,
      name,
      loginMethod,
      selfRegistrationEnabled,
    }));
  }

  async register(dto: RegisterDto) {
    const role = await this.roleRepository.findActiveBySlug(dto.roleSlug);

    if (
      !role ||
      !role.selfRegistrationEnabled ||
      role.permissions.some((permission) =>
        ADMINISTRATIVE_PERMISSION_KEYS.some(
          (key) => key === permission.key,
        ),
      )
    ) {
      throw new ForbiddenException({
        errorCode: 'ROLE_REGISTRATION_DISABLED',
        message: 'Registration is not available for this role',
      });
    }

    const email = dto.email?.toLowerCase().trim() ?? null;
    const phone = dto.phone?.trim() ?? null;
    this.assertRoleIdentifier(role.loginMethod, email, phone);

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: AUTH_CONSTANTS.PASSWORD_HASH_MEMORY_COST,
      timeCost: AUTH_CONSTANTS.PASSWORD_HASH_TIME_COST,
      parallelism: AUTH_CONSTANTS.PASSWORD_HASH_PARALLELISM,
    });

    try {
      const user = await this.userRepository.createUser({
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email,
        phone,
        passwordHash,
        roleId: role.id,
      });

      return {
        message: 'Registration completed successfully.',
        user: this.toPublicUser(user, role),
      };
    } catch (error: unknown) {
      if (isDuplicateEntry(error)) {
        throw new ConflictException({
          errorCode: 'IDENTIFIER_ALREADY_EXISTS',
          message: 'An account with this email or phone already exists',
        });
      }

      throw error;
    }
  }

  async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const role = await this.roleRepository.findActiveBySlug(dto.roleSlug);

    if (!role) {
      throw this.invalidCredentials();
    }

    const user = role.loginMethod === LoginMethod.EMAIL
      ? await this.userRepository.findByEmailWithPassword(
          dto.identifier.toLowerCase().trim(),
        )
      : await this.userRepository.findByPhoneWithPassword(
          dto.identifier.trim(),
        );

    if (
      !user ||
      user.userRole?.roleId !== role.id ||
      user.status !== UserStatus.ACTIVE
    ) {
      throw this.invalidCredentials();
    }

    const passwordIsValid = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    if (!passwordIsValid) {
      throw this.invalidCredentials();
    }

    const activeSessions =
      await this.authSessionRepository.countActiveByUserId(user.id);
    if (activeSessions >= AUTH_CONSTANTS.MAX_ACTIVE_SESSIONS) {
      throw new ForbiddenException({
        errorCode: 'MAX_ACTIVE_SESSIONS_REACHED',
        message: 'Maximum active sessions reached',
      });
    }

    const tokens = await this.tokenService.createSession(
      user.id,
      ipAddress,
      userAgent,
    );
    await this.userRepository.update(user.id, {
      lastLoginAt: new Date(),
    });

    return {
      message: 'Login successful',
      user: this.toPublicUser(user, role),
      permissions: this.effectivePermissionKeys(user, role),
      tokens,
    };
  }

  async refresh(dto: RefreshTokenDto) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(
        dto.refreshToken,
        {
          secret: this.configService.getOrThrow<string>(
            'JWT_REFRESH_SECRET',
          ),
          algorithms: ['HS256'],
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (
      payload.type !== 'refresh' ||
      !Number.isInteger(payload.sub) ||
      payload.sub < 1 ||
      typeof payload.sid !== 'string'
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.authSessionRepository.findBySessionIdWithHash(
      payload.sid,
    );

    if (
      !session ||
      session.userId !== payload.sub ||
      session.status !== SessionStatus.ACTIVE ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Session is no longer active');
    }

    const currentHash = this.tokenService.hashToken(dto.refreshToken);
    const storedHash = Buffer.from(session.refreshTokenHash, 'hex');
    const suppliedHash = Buffer.from(currentHash, 'hex');

    if (
      storedHash.length !== suppliedHash.length ||
      !timingSafeEqual(storedHash, suppliedHash)
    ) {
      await this.sessionService.revokeSession(session.sessionId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    const user = await this.userRepository.findProfileById(payload.sub);
    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      !user.userRole?.role?.isActive
    ) {
      await this.sessionService.revokeSession(session.sessionId);
      throw new UnauthorizedException('Account is not active');
    }

    const tokens = await this.tokenService.rotateRefreshToken(
      user.id,
      session.sessionId,
      currentHash,
    );

    if (!tokens) {
      await this.sessionService.revokeSession(session.sessionId);
      throw new UnauthorizedException('Refresh token has already been used');
    }

    return { message: 'Token refreshed', tokens };
  }

  async logout(sessionId: string): Promise<{ message: string }> {
    await this.sessionService.revokeSession(sessionId);
    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: number): Promise<{ message: string }> {
    await this.sessionService.revokeAllUserSessions(userId);
    return { message: 'All sessions revoked successfully' };
  }

  async getProfile(userId: number) {
    const user = await this.userRepository.findProfileById(userId);
    const role = user?.userRole?.role;
    if (!user || !role) {
      throw new UnauthorizedException('Account is not available');
    }

    return {
      user: this.toPublicUser(user, role),
      permissions: this.effectivePermissionKeys(user, role),
    };
  }

  checkAuthorization(
    user: AuthenticatedUser,
    dto: CheckAuthorizationDto,
  ) {
    const permissionKeys = dto.permissionKeys ?? [];
    const roleSlugs = dto.roleSlugs ?? [];
    if (permissionKeys.length === 0 && roleSlugs.length === 0) {
      throw new BadRequestException({
        errorCode: 'AUTHORIZATION_CHECKS_REQUIRED',
        message: 'Provide at least one permission key or role slug to check',
      });
    }

    const grantedPermissions = new Set(
      user.permissions.map((permission) => permission.key),
    );
    const permissions: Record<string, boolean> = {};
    for (const key of permissionKeys) {
      permissions[key] =
        user.role.isSuperAdmin || grantedPermissions.has(key);
    }

    const roles: Record<string, boolean> = {};
    for (const slug of roleSlugs) {
      roles[slug] = user.role.slug === slug;
    }

    return {
      isSuperAdmin: user.role.isSuperAdmin,
      role: {
        id: user.role.id,
        slug: user.role.slug,
        name: user.role.name,
      },
      permissions,
      roles,
    };
  }

  private effectivePermissionKeys(
    user: {
      permissions: Array<{ id: number; key: string; isActive: boolean }>;
    },
    role: RoleEntity,
  ): string[] {
    if (role.isSuperAdmin) {
      return ['*'];
    }

    const rolePermissionIds = new Set(
      role.permissions
        .filter((permission) => permission.isActive)
        .map((permission) => permission.id),
    );

    return user.permissions
      .filter(
        (permission) =>
          permission.isActive && rolePermissionIds.has(permission.id),
      )
      .map((permission) => permission.key);
  }

  private assertRoleIdentifier(
    loginMethod: LoginMethod,
    email: string | null,
    phone: string | null,
  ): void {
    if (loginMethod === LoginMethod.EMAIL && !email) {
      throw new ConflictException({
        errorCode: 'EMAIL_REQUIRED_FOR_ROLE',
        message: 'An email address is required for this role',
      });
    }

    if (loginMethod === LoginMethod.PHONE && !phone) {
      throw new ConflictException({
        errorCode: 'PHONE_REQUIRED_FOR_ROLE',
        message: 'A phone number is required for this role',
      });
    }
  }

  private toPublicUser(
    user: {
      id: number;
      firstName: string;
      lastName: string;
      email: string | null;
      phone: string | null;
      status: UserStatus;
      createdAt: Date;
    },
    role: RoleEntity,
  ) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      status: user.status,
      role: {
        id: role.id,
        slug: role.slug,
        name: role.name,
        loginMethod: role.loginMethod,
        isSuperAdmin: role.isSuperAdmin,
        permissions: role.permissions
          .filter((permission) => permission.isActive)
          .map(({ id, key, name, description }) => ({
            id,
            key,
            name,
            description,
          })),
      },
      createdAt: user.createdAt,
    };
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException({
      errorCode: 'INVALID_CREDENTIALS',
      message: 'Invalid role, identifier or password',
    });
  }

}
