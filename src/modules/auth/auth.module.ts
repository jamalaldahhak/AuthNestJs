import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../users/users.module.js';

import { AuthSessionEntity } from './models/auth-session.entity.js';
import { AuthSessionRepository } from './repositories/auth-session.repository.js';
import { AuthService } from './services/auth.service.js';
import { AuthController } from './controllers/auth.controller.js';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TokenService } from './services/token.service.js';
import { SessionService } from './services/session.service.js';
import { RoleEntity } from '../authorization/models/role.entity.js';
import { PermissionEntity } from '../authorization/models/permission.entity.js';
import { AccessTokenGuard } from './guards/access-token.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';
import { UserEntity } from '../users/models/user.entity.js';
import { RoleRepository } from '../authorization/repositories/role.repository.js';
import { parseJwtDuration } from './utils/jwt-duration.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuthSessionEntity,
      UserEntity,
      RoleEntity,
      PermissionEntity,
    ]),
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const accessSecret = configService.getOrThrow<string>(
          'JWT_ACCESS_SECRET',
        );
        const refreshSecret = configService.getOrThrow<string>(
          'JWT_REFRESH_SECRET',
        );
        const accessTtl = parseJwtDuration(
          configService.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN'),
        );
        const refreshTtl = parseJwtDuration(
          configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'),
        );

        if (
          Buffer.byteLength(accessSecret) < 32 ||
          Buffer.byteLength(refreshSecret) < 32 ||
          accessSecret === refreshSecret
        ) {
          throw new Error(
            'JWT access and refresh secrets must be different and at least 32 bytes long',
          );
        }
        if (refreshTtl <= accessTtl) {
          throw new Error(
            'JWT refresh expiration must be longer than access expiration',
          );
        }

        return {
          secret: accessSecret,
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthSessionRepository,
    AuthService,
    TokenService,
    SessionService,
    RoleRepository,
    AccessTokenGuard,
    PermissionsGuard,
  ],
  exports: [
    AuthSessionRepository,
    AuthService,
    TokenService,
    SessionService,
    RoleRepository,
    AccessTokenGuard,
    PermissionsGuard,
    JwtModule,
  ],
})
export class AuthModule {}