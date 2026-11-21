import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { UserRepository } from '../../users/repositories/user.repository.js';
import { CreateRoleDto } from '../dtos/create-role.dto.js';
import { SetRolePermissionsDto } from '../dtos/set-role-permissions.dto.js';
import { UpdateRoleDto } from '../dtos/update-role.dto.js';
import { LoginMethod } from '../constants/login-method.enum.js';
import { ADMINISTRATIVE_PERMISSION_KEYS } from '../constants/administrative-permissions.js';
import { PermissionRepository } from '../repositories/permission.repository.js';
import { RoleRepository } from '../repositories/role.repository.js';
import { isDuplicateEntry } from '../../../database/is-duplicate-entry.js';

@Injectable()
export class RolesService {
  constructor(
    private readonly roleRepository: RoleRepository,
    private readonly permissionRepository: PermissionRepository,
    private readonly userRepository: UserRepository,
  ) {}

  findAll() {
    return this.roleRepository.findAllWithPermissions();
  }

  async findById(id: number) {
    const role = await this.roleRepository.findWithPermissionsById(id);
    if (!role) {
      throw new NotFoundException({
        errorCode: 'ROLE_NOT_FOUND',
        message: 'Role not found',
      });
    }

    return role;
  }

  async create(dto: CreateRoleDto) {
    const existing = await this.roleRepository.findBySlug(dto.slug);
    if (existing) {
      throw new ConflictException({
        errorCode: 'ROLE_SLUG_ALREADY_EXISTS',
        message: 'A role with this slug already exists',
      });
    }

    try {
      return await this.roleRepository.create({
        ...dto,
        description: dto.description ?? null,
        selfRegistrationEnabled: dto.selfRegistrationEnabled ?? false,
        isActive: dto.isActive ?? true,
        isSystem: false,
        isSuperAdmin: false,
        permissions: [],
      });
    } catch (error: unknown) {
      if (isDuplicateEntry(error)) {
        throw new ConflictException({
          errorCode: 'ROLE_SLUG_ALREADY_EXISTS',
          message: 'A role with this slug already exists',
        });
      }

      throw error;
    }
  }

  async update(id: number, dto: UpdateRoleDto) {
    const role = await this.findById(id);
    if (
      role.isSystem &&
      (dto.loginMethod !== undefined ||
        dto.isActive === false ||
        dto.selfRegistrationEnabled === true)
    ) {
      throw new ConflictException({
        errorCode: 'SYSTEM_ROLE_PROTECTED',
        message: 'System role authentication and registration settings cannot be changed',
      });
    }
    if (
      dto.selfRegistrationEnabled === true &&
      role.permissions.some((permission) =>
        ADMINISTRATIVE_PERMISSION_KEYS.some(
          (key) => key === permission.key,
        ),
      )
    ) {
      throw new ConflictException({
        errorCode: 'PUBLIC_ROLE_HAS_ADMIN_PERMISSIONS',
        message: 'A role with user-management permissions cannot allow public registration',
      });
    }

    const nextMethod = dto.loginMethod ?? role.loginMethod;
    if (nextMethod !== role.loginMethod) {
      const missingIdentifierCount =
        await this.userRepository.countMissingRoleIdentifier(
          id,
          nextMethod === LoginMethod.EMAIL ? 'email' : 'phone',
        );

      if (missingIdentifierCount > 0) {
        throw new ConflictException({
          errorCode: 'ROLE_LOGIN_METHOD_INCOMPATIBLE',
          message: 'Some users do not have the identifier required by this login method',
        });
      }
    }

    const updated = await this.roleRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException({
        errorCode: 'ROLE_NOT_FOUND',
        message: 'Role not found',
      });
    }

    return this.findById(id);
  }

  async setPermissions(id: number, dto: SetRolePermissionsDto) {
    const role = await this.findById(id);
    const permissions = await this.permissionRepository.findByIds(
      dto.permissionIds,
    );

    if (
      permissions.length !== dto.permissionIds.length ||
      permissions.some((permission) => !permission.isActive)
    ) {
      throw new NotFoundException({
        errorCode: 'PERMISSION_NOT_FOUND',
        message: 'One or more permissions do not exist or are inactive',
      });
    }
    if (
      role.selfRegistrationEnabled &&
      permissions.some((permission) =>
        ADMINISTRATIVE_PERMISSION_KEYS.some(
          (key) => key === permission.key,
        ),
      )
    ) {
      throw new ConflictException({
        errorCode: 'PUBLIC_ROLE_HAS_ADMIN_PERMISSIONS',
        message: 'User-management permissions cannot be assigned to a public-registration role',
      });
    }

    role.permissions = permissions;
    const updatedRole = await this.roleRepository.save(role);
    await this.userRepository.removeRolePermissionsFromUsers(
      id,
      permissions.map((permission) => permission.id),
    );

    return updatedRole;
  }

  async remove(id: number): Promise<{ message: string }> {
    const role = await this.findById(id);
    if (role.isSystem || role.isSuperAdmin) {
      throw new ConflictException({
        errorCode: 'SYSTEM_ROLE_PROTECTED',
        message: 'A system role cannot be deleted',
      });
    }

    const assignedUsers = await this.userRepository.countByRoleId(id);
    if (assignedUsers > 0) {
      throw new ConflictException({
        errorCode: 'ROLE_IN_USE',
        message: 'Reassign users before deleting this role',
      });
    }

    await this.roleRepository.delete(id);
    return { message: 'Role deleted successfully' };
  }
}
