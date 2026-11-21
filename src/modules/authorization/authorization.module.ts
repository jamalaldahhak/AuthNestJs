import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';
import { AuthSessionEntity } from '../auth/models/auth-session.entity.js';
import { UsersModule } from '../users/users.module.js';
import { UserEntity } from '../users/models/user.entity.js';
import { PermissionEntity } from './models/permission.entity.js';
import { RoleEntity } from './models/role.entity.js';
import { PermissionsController } from './controllers/permissions.controller.js';
import { RolesController } from './controllers/roles.controller.js';
import { UsersAdminController } from './controllers/users-admin.controller.js';
import { PermissionRepository } from './repositories/permission.repository.js';
import { RoleRepository } from './repositories/role.repository.js';
import { AuthorizationBootstrapService } from './services/authorization-bootstrap.service.js';
import { PermissionsService } from './services/permissions.service.js';
import { RolesService } from './services/roles.service.js';
import { UsersAdminService } from './services/users-admin.service.js';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    TypeOrmModule.forFeature([
      AuthSessionEntity,
      PermissionEntity,
      RoleEntity,
      UserEntity,
    ]),
  ],
  controllers: [
    PermissionsController,
    RolesController,
    UsersAdminController,
  ],
  providers: [
    AuthorizationBootstrapService,
    PermissionRepository,
    PermissionsService,
    RoleRepository,
    RolesService,
    UsersAdminService,
  ],
})
export class AuthorizationModule {}
