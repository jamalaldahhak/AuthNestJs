import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';

import { AUTH_CONSTANTS } from '../../auth/constants/auth.constants.js';
import { LoginMethod } from '../constants/login-method.enum.js';
import { CreateUserDto } from '../dtos/create-user.dto.js';
import { UpdateUserDto } from '../dtos/update-user.dto.js';
import { RoleEntity } from '../models/role.entity.js';
import { UserEntity } from '../../users/models/user.entity.js';
import { UserRepository } from '../../users/repositories/user.repository.js';
import { RoleRepository } from '../repositories/role.repository.js';
import { PermissionRepository } from '../repositories/permission.repository.js';
import { isDuplicateEntry } from '../../../database/is-duplicate-entry.js';
import { ADMINISTRATIVE_PERMISSION_KEYS } from '../constants/administrative-permissions.js';

@Injectable()
export class UsersAdminService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly roleRepository: RoleRepository,
    private readonly permissionRepository: PermissionRepository,
  ) {}

  async findAll(page = 1, limit = 20) {
    if (
      !Number.isSafeInteger(page) ||
      !Number.isSafeInteger(limit) ||
      page < 1 ||
      limit < 1
    ) {
      throw new BadRequestException({
        errorCode: 'INVALID_PAGINATION',
        message: 'Page and limit must be positive integers',
      });
    }

    const currentPage = page;
    const pageSize = Math.min(100, limit);
    const [items, totalItems] = await this.userRepository.findAdminPage(
      currentPage,
      pageSize,
    );

    return {
      items: items.map((user) => this.toAdminUser(user)),
      meta: {
        totalItems,
        itemCount: items.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(totalItems / pageSize),
        currentPage,
      },
    };
  }

  async findById(id: number) {
    const user = await this.userRepository.findAdminById(id);
    if (!user) {
      throw new NotFoundException({
        errorCode: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    return this.toAdminUser(user);
  }

  async create(
    dto: CreateUserDto,
    isSuperAdmin: boolean,
    canAssignRoles: boolean,
    canManagePermissions: boolean,
  ) {
    if (!canAssignRoles) {
      throw new ForbiddenException({
        errorCode: 'ROLE_ASSIGNMENT_FORBIDDEN',
        message: 'The users.assign-role permission is required',
      });
    }
    if (!canManagePermissions) {
      throw new ForbiddenException({
        errorCode: 'USER_PERMISSION_ASSIGNMENT_FORBIDDEN',
        message: 'The users.permissions.manage permission is required',
      });
    }

    const role = await this.findActiveRole(dto.roleId);
    if (role.isSuperAdmin && !isSuperAdmin) {
      throw new ForbiddenException({
        errorCode: 'SUPER_ADMIN_ASSIGNMENT_RESTRICTED',
        message: 'Only a super administrator can assign the super-admin role',
      });
    }
    this.assertAdministrativeRoleAssignment(role, isSuperAdmin);

    const email = dto.email?.toLowerCase().trim() ?? null;
    const phone = dto.phone?.trim() ?? null;
    this.assertRoleIdentifier(role, email, phone);
    const permissions = await this.validateSelectedPermissions(
      role,
      dto.permissionIds,
    );

    const passwordHash = await this.hashPassword(dto.password);
    try {
      const created = await this.userRepository.createUser({
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email,
        phone,
        passwordHash,
        roleId: role.id,
        permissions,
      });
      return this.findById(created.id);
    } catch (error: unknown) {
      if (isDuplicateEntry(error)) {
        throw this.duplicateIdentifier();
      }

      throw error;
    }
  }

  async update(
    id: number,
    dto: UpdateUserDto,
    isSuperAdmin: boolean,
    canAssignRoles: boolean,
  ) {
    try {
      const user = await this.userRepository.findAdminById(id);
      if (!user) {
        throw new NotFoundException({
          errorCode: 'USER_NOT_FOUND',
          message: 'User not found',
        });
      }
      if (user.userRole?.role?.isSuperAdmin && !isSuperAdmin) {
        throw new ForbiddenException({
          errorCode: 'SUPER_ADMIN_ACCOUNT_PROTECTED',
          message: 'Only a super administrator can modify a super-admin account',
        });
      }
      if (dto.roleId !== undefined && !canAssignRoles) {
        throw new ForbiddenException({
          errorCode: 'ROLE_ASSIGNMENT_FORBIDDEN',
          message: 'The users.assign-role permission is required',
        });
      }

      const currentRoleId = user.userRole?.roleId;
      if (currentRoleId === undefined) {
        throw new ConflictException({
          errorCode: 'USER_ROLE_MISSING',
          message: 'User does not have a valid role',
        });
      }

      const role = dto.roleId === undefined
        ? await this.roleRepository.findById(currentRoleId)
        : await this.findActiveRole(dto.roleId);
      if (!role) {
        throw new NotFoundException({
          errorCode: 'ROLE_NOT_FOUND',
          message: 'User role not found',
        });
      }
      if (role.isSuperAdmin && !isSuperAdmin) {
        throw new ForbiddenException({
          errorCode: 'SUPER_ADMIN_ASSIGNMENT_RESTRICTED',
          message: 'Only a super administrator can assign the super-admin role',
        });
      }
      if (dto.roleId !== undefined) {
        this.assertAdministrativeRoleAssignment(role, isSuperAdmin);
      }

      const email = dto.email === undefined
        ? user.email
        : dto.email?.toLowerCase().trim() ?? null;
      const phone = dto.phone === undefined
        ? user.phone
        : dto.phone?.trim() ?? null;
      this.assertRoleIdentifier(role, email, phone);

      const revokeSessions =
        dto.roleId !== undefined ||
        dto.status !== undefined ||
        dto.password !== undefined ||
        dto.email !== undefined ||
        dto.phone !== undefined;
      const changes: Partial<UserEntity> = {
        email,
        phone,
      };
      if (dto.firstName !== undefined) {
        changes.firstName = dto.firstName.trim();
      }
      if (dto.lastName !== undefined) {
        changes.lastName = dto.lastName.trim();
      }
      if (dto.status !== undefined) {
        changes.status = dto.status;
      }
      if (dto.password !== undefined) {
        changes.passwordHash = await this.hashPassword(dto.password);
      }

      const updated = await this.userRepository.updateAdminUser(
        id,
        changes,
        role.id,
        revokeSessions,
      );
      if (!updated) {
        throw new NotFoundException({
          errorCode: 'USER_NOT_FOUND',
          message: 'User not found',
        });
      }
    } catch (error: unknown) {
      if (isDuplicateEntry(error)) {
        throw this.duplicateIdentifier();
      }

      throw error;
    }

    return this.findById(id);
  }

  async replacePermissions(
    id: number,
    permissionIds: number[],
    isSuperAdmin: boolean,
  ) {
    const user = await this.userRepository.findAdminById(id);
    if (!user) {
      throw new NotFoundException({
        errorCode: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }
    const role = user.userRole?.role;
    if (!role) {
      throw new ConflictException({
        errorCode: 'USER_ROLE_MISSING',
        message: 'User does not have a valid role',
      });
    }
    if (role.isSuperAdmin && !isSuperAdmin) {
      throw new ForbiddenException({
        errorCode: 'SUPER_ADMIN_ACCOUNT_PROTECTED',
        message: 'Only a super administrator can modify a super-admin account',
      });
    }

    const permissions = await this.validateSelectedPermissions(
      role,
      permissionIds,
    );
    const updated = await this.userRepository.replaceUserPermissions(
      id,
      permissions,
    );
    if (!updated) {
      throw new NotFoundException({
        errorCode: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    return this.toAdminUser(updated);
  }

  private toAdminUser(user: UserEntity) {
    const { userRole, ...publicUser } = user;
    return {
      ...publicUser,
      role: userRole?.role ?? null,
    };
  }

  private async findActiveRole(id: number): Promise<RoleEntity> {
    const role = await this.roleRepository.findActiveById(id);
    if (!role) {
      throw new NotFoundException({
        errorCode: 'ROLE_NOT_FOUND',
        message: 'An active role with this id was not found',
      });
    }

    return role;
  }

  private assertRoleIdentifier(
    role: RoleEntity,
    email: string | null,
    phone: string | null,
  ): void {
    if (role.loginMethod === LoginMethod.EMAIL && !email) {
      throw new ConflictException({
        errorCode: 'EMAIL_REQUIRED_FOR_ROLE',
        message: 'An email address is required for this role',
      });
    }

    if (role.loginMethod === LoginMethod.PHONE && !phone) {
      throw new ConflictException({
        errorCode: 'PHONE_REQUIRED_FOR_ROLE',
        message: 'A phone number is required for this role',
      });
    }
  }

  private assertAdministrativeRoleAssignment(
    role: RoleEntity,
    isSuperAdmin: boolean,
  ): void {
    if (
      !isSuperAdmin &&
      role.permissions?.some((permission) =>
        ADMINISTRATIVE_PERMISSION_KEYS.some(
          (key) => key === permission.key,
        ),
      )
    ) {
      throw new ForbiddenException({
        errorCode: 'ADMIN_ROLE_ASSIGNMENT_RESTRICTED',
        message:
          'Only a super administrator can assign a role with user-management permissions',
      });
    }
  }

  private async validateSelectedPermissions(
    role: RoleEntity,
    permissionIds: number[],
  ) {
    const permissions =
      await this.permissionRepository.findByIds(permissionIds);
    const allowedIds = new Set(
      role.permissions
        .filter((permission) => permission.isActive)
        .map((permission) => permission.id),
    );

    if (
      permissions.length !== permissionIds.length ||
      permissions.some(
        (permission) =>
          !permission.isActive || !allowedIds.has(permission.id),
      )
    ) {
      throw new BadRequestException({
        errorCode: 'PERMISSION_NOT_ALLOWED_FOR_ROLE',
        message:
          'Every user permission must be active and assigned to the selected role',
      });
    }

    return permissions;
  }

  private hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: AUTH_CONSTANTS.PASSWORD_HASH_MEMORY_COST,
      timeCost: AUTH_CONSTANTS.PASSWORD_HASH_TIME_COST,
      parallelism: AUTH_CONSTANTS.PASSWORD_HASH_PARALLELISM,
    });
  }

  private duplicateIdentifier(): ConflictException {
    return new ConflictException({
      errorCode: 'IDENTIFIER_ALREADY_EXISTS',
      message: 'An account with this email or phone already exists',
    });
  }
}
