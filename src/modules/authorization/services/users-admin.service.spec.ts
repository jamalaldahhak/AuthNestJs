import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { LoginMethod } from '../constants/login-method.enum.js';
import { RoleEntity } from '../models/role.entity.js';
import { UserRepository } from '../../users/repositories/user.repository.js';
import { RoleRepository } from '../repositories/role.repository.js';
import { PermissionRepository } from '../repositories/permission.repository.js';
import { UsersAdminService } from './users-admin.service.js';

describe('UsersAdminService user permissions', () => {
  it('rejects selected permissions that are not enabled for the role', async () => {
    const role = {
      id: 4,
      loginMethod: LoginMethod.EMAIL,
      isSuperAdmin: false,
      permissions: [
        { id: 2, key: 'orders.read', isActive: true },
      ],
    } as RoleEntity;
    const userRepository = {
      createUser: vi.fn(),
    } as unknown as UserRepository;
    const roleRepository = {
      findActiveById: vi.fn().mockResolvedValue(role),
    } as unknown as RoleRepository;
    const permissionRepository = {
      findByIds: vi.fn().mockResolvedValue([
        { id: 3, key: 'orders.update', isActive: true },
      ]),
    } as unknown as PermissionRepository;
    const service = new UsersAdminService(
      userRepository,
      roleRepository,
      permissionRepository,
    );

    await expect(
      service.create(
        {
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          password: 'StrongPass123!',
          roleId: role.id,
          permissionIds: [3],
        },
        false,
        true,
        true,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(userRepository.createUser).not.toHaveBeenCalled();
  });

  it('allows saving an empty permission selection', async () => {
    const role = {
      id: 4,
      loginMethod: LoginMethod.EMAIL,
      isSuperAdmin: false,
      permissions: [
        { id: 2, key: 'orders.read', isActive: true },
      ],
    } as RoleEntity;
    const userRepository = {
      createUser: vi.fn().mockResolvedValue({ id: 9 }),
      findAdminById: vi.fn().mockResolvedValue({ id: 9 }),
    } as unknown as UserRepository;
    const roleRepository = {
      findActiveById: vi.fn().mockResolvedValue(role),
    } as unknown as RoleRepository;
    const permissionRepository = {
      findByIds: vi.fn().mockResolvedValue([]),
    } as unknown as PermissionRepository;
    const service = new UsersAdminService(
      userRepository,
      roleRepository,
      permissionRepository,
    );

    await service.create(
      {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'StrongPass123!',
        roleId: role.id,
        permissionIds: [],
      },
      false,
      true,
      true,
    );

    expect(userRepository.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ permissions: [] }),
    );
  });
});
