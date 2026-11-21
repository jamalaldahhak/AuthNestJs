import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { DataSource, Repository } from 'typeorm';

import { AUTH_CONSTANTS } from '../../auth/constants/auth.constants.js';
import { UserStatus } from '../../users/constants/user-status.enum.js';
import { UserEntity } from '../../users/models/user.entity.js';
import { UserRoleEntity } from '../../users/models/user-role.entity.js';
import { isStrongPassword } from '../../auth/validators/password.validator.js';
import { LoginMethod } from '../constants/login-method.enum.js';
import { PermissionEntity } from '../models/permission.entity.js';
import { RoleEntity } from '../models/role.entity.js';
import { isDuplicateEntry } from '../../../database/is-duplicate-entry.js';

const CORE_PERMISSIONS = [
  { key: 'roles.manage', name: 'Manage roles' },
  { key: 'permissions.manage', name: 'Manage permissions' },
  { key: 'users.read', name: 'View users' },
  { key: 'users.create', name: 'Create users' },
  { key: 'users.update', name: 'Update users' },
  { key: 'users.assign-role', name: 'Assign user roles' },
  { key: 'users.permissions.manage', name: 'Assign user permissions' },
];

@Injectable()
export class AuthorizationBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AuthorizationBootstrapService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissionRepository: Repository<PermissionEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    const permissions = await this.ensureCorePermissions();
    const role = await this.ensureSuperAdminRole(permissions);
    await this.ensureInitialAdmin(role, permissions);
  }

  private async ensureCorePermissions(): Promise<PermissionEntity[]> {
    const permissions: PermissionEntity[] = [];

    for (const definition of CORE_PERMISSIONS) {
      let permission = await this.permissionRepository.findOne({
        where: { key: definition.key },
      });
      if (!permission) {
        try {
          permission = await this.permissionRepository.save(
            this.permissionRepository.create({
              ...definition,
              description: null,
              isActive: true,
            }),
          );
        } catch (error: unknown) {
          if (!isDuplicateEntry(error)) {
            throw error;
          }
          permission = await this.permissionRepository.findOne({
            where: { key: definition.key },
          });
          if (!permission) {
            throw error;
          }
        }
      }
      permissions.push(permission);
    }

    return permissions;
  }

  private async ensureSuperAdminRole(
    permissions: PermissionEntity[],
  ): Promise<RoleEntity> {
    let role = await this.roleRepository.findOne({
      where: { slug: 'super-admin' },
      relations: { permissions: true },
    });

    if (!role) {
      role = this.roleRepository.create({
        slug: 'super-admin',
        name: 'Super administrator',
        description: 'System role with unrestricted administrative access',
        loginMethod: LoginMethod.EMAIL,
        selfRegistrationEnabled: false,
        isActive: true,
        isSystem: true,
        isSuperAdmin: true,
      });
    } else {
      role.isSystem = true;
      role.isSuperAdmin = true;
      role.isActive = true;
    }

    role.permissions = permissions;
    try {
      return await this.roleRepository.save(role);
    } catch (error: unknown) {
      if (!isDuplicateEntry(error)) {
        throw error;
      }
      const createdByAnotherInstance = await this.roleRepository.findOne({
        where: { slug: 'super-admin' },
        relations: { permissions: true },
      });
      if (!createdByAnotherInstance) {
        throw error;
      }
      createdByAnotherInstance.isSystem = true;
      createdByAnotherInstance.isSuperAdmin = true;
      createdByAnotherInstance.isActive = true;
      createdByAnotherInstance.permissions = permissions;
      return this.roleRepository.save(createdByAnotherInstance);
    }
  }

  private async ensureInitialAdmin(
    role: RoleEntity,
    permissions: PermissionEntity[],
  ): Promise<void> {
    const email = this.configService.get<string>('INITIAL_ADMIN_EMAIL')
      ?.toLowerCase()
      .trim();
    const password = this.configService.get<string>('INITIAL_ADMIN_PASSWORD');

    if (!email && !password) {
      this.logger.warn(
        'Initial administrator was not seeded. Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD before enabling dashboard administration.',
      );
      return;
    }

    if (!email || !password) {
      throw new Error(
        'INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD must both be configured',
      );
    }
    if (!isStrongPassword(password)) {
      throw new Error(
        'INITIAL_ADMIN_PASSWORD must satisfy the configured password requirements',
      );
    }

    const existing = await this.userRepository.findOne({
      where: { email },
      relations: { userRole: true },
    });
    if (existing) {
      if (existing.userRole?.roleId !== role.id) {
        throw new ConflictException(
          'INITIAL_ADMIN_EMAIL is already assigned to a non-system role',
        );
      }
      return;
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: AUTH_CONSTANTS.PASSWORD_HASH_MEMORY_COST,
      timeCost: AUTH_CONSTANTS.PASSWORD_HASH_TIME_COST,
      parallelism: AUTH_CONSTANTS.PASSWORD_HASH_PARALLELISM,
    });

    try {
      await this.dataSource.transaction(async (manager) => {
        const users = manager.getRepository(UserEntity);
        const user = await users.save(
          users.create({
            firstName:
              this.configService.get<string>('INITIAL_ADMIN_FIRST_NAME') ??
              'System',
            lastName:
              this.configService.get<string>('INITIAL_ADMIN_LAST_NAME') ??
              'Administrator',
            email,
            phone: null,
            passwordHash,
            permissions,
            status: UserStatus.ACTIVE,
          }),
        );
        await manager.getRepository(UserRoleEntity).save({
          userId: user.id,
          roleId: role.id,
        });
      });
    } catch (error: unknown) {
      if (!isDuplicateEntry(error)) {
        throw error;
      }
      const racedUser = await this.userRepository.findOne({
        where: { email },
        relations: { userRole: true },
      });
      if (!racedUser || racedUser.userRole?.roleId !== role.id) {
        throw error;
      }
    }
    this.logger.log(`Initial administrator seeded for ${email}`);
  }
}
