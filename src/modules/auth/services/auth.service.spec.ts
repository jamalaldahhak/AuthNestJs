import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';

import { AuthSessionRepository } from '../repositories/auth-session.repository.js';
import { AuthService } from './auth.service.js';
import { SessionService } from './session.service.js';
import { TokenService } from './token.service.js';
import { UserRepository } from '../../users/repositories/user.repository.js';
import { UserEntity } from '../../users/models/user.entity.js';
import { PermissionEntity } from '../../authorization/models/permission.entity.js';
import { RoleEntity } from '../../authorization/models/role.entity.js';
import { RoleRepository } from '../../authorization/repositories/role.repository.js';
import { LoginMethod } from '../../authorization/constants/login-method.enum.js';
import { UserStatus } from '../../users/constants/user-status.enum.js';

vi.mock('argon2', () => ({
  hash: vi.fn().mockResolvedValue('password-hash'),
  verify: vi.fn().mockResolvedValue(true),
  argon2id: 2,
}));

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: {
    createUser: ReturnType<typeof vi.fn>;
    findByEmailWithPassword: ReturnType<typeof vi.fn>;
    findByPhoneWithPassword: ReturnType<typeof vi.fn>;
    findProfileById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let roleRepository: {
    findActiveBySlug: ReturnType<typeof vi.fn>;
    findActiveLoginOptions: ReturnType<typeof vi.fn>;
  };
  let tokenService: {
    createSession: ReturnType<typeof vi.fn>;
    hashToken: ReturnType<typeof vi.fn>;
    rotateRefreshToken: ReturnType<typeof vi.fn>;
  };
  let authSessionRepository: {
    countActiveByUserId: ReturnType<typeof vi.fn>;
    findBySessionIdWithHash: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    userRepository = {
      createUser: vi.fn(),
      findByEmailWithPassword: vi.fn(),
      findByPhoneWithPassword: vi.fn(),
      findProfileById: vi.fn(),
      update: vi.fn(),
    };
    roleRepository = {
      findActiveBySlug: vi.fn(),
      findActiveLoginOptions: vi.fn(),
    };
    tokenService = {
      createSession: vi.fn().mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
        tokenType: 'Bearer',
        expiresIn: 900,
      }),
      hashToken: vi.fn(),
      rotateRefreshToken: vi.fn(),
    };
    authSessionRepository = {
      countActiveByUserId: vi.fn().mockResolvedValue(0),
      findBySessionIdWithHash: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: userRepository },
        { provide: TokenService, useValue: tokenService },
        { provide: SessionService, useValue: { revokeSession: vi.fn() } },
        {
          provide: AuthSessionRepository,
          useValue: authSessionRepository,
        },
        { provide: JwtService, useValue: { verifyAsync: vi.fn() } },
        {
          provide: ConfigService,
          useValue: { getOrThrow: vi.fn() },
        },
        {
          provide: RoleRepository,
          useValue: roleRepository,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('does not allow public registration into a role that opted out', async () => {
    roleRepository.findActiveBySlug.mockResolvedValue(null);

    await expect(
      service.register({
        roleSlug: 'staff',
        firstName: 'Sam',
        lastName: 'Smith',
        email: 'sam@example.com',
        password: 'StrongPass123!',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(userRepository.createUser).not.toHaveBeenCalled();
  });

  it('uses the role phone setting to select the login identifier', async () => {
    const role = {
      id: 7,
      slug: 'courier',
      name: 'Courier',
      loginMethod: LoginMethod.PHONE,
      isSuperAdmin: false,
      permissions: [],
    } as RoleEntity;
    const user = {
      id: 22,
      userRole: { roleId: role.id, role },
      status: UserStatus.ACTIVE,
      firstName: 'Sam',
      lastName: 'Smith',
      email: null,
      phone: '+15555550123',
      passwordHash: 'password-hash',
      permissions: [],
      createdAt: new Date(),
    } as UserEntity;
    roleRepository.findActiveBySlug.mockResolvedValue(role);
    userRepository.findByPhoneWithPassword.mockResolvedValue(user);
    userRepository.update.mockResolvedValue(user);

    await expect(
      service.login(
        {
          roleSlug: 'courier',
          identifier: '+15555550123',
          password: 'StrongPass123!',
        },
      ),
    ).resolves.toMatchObject({
      permissions: [],
      user: { role: { loginMethod: LoginMethod.PHONE } },
    });

    expect(userRepository.findByPhoneWithPassword)
      .toHaveBeenCalledWith('+15555550123');
    expect(userRepository.findByEmailWithPassword).not.toHaveBeenCalled();
    expect(tokenService.createSession).toHaveBeenCalledWith(22, undefined, undefined);
  });

  it('checks assigned permissions and the actual role for frontend UI', () => {
    const result = service.checkAuthorization(
      {
        id: 22,
        sessionId: 'session-id',
        role: {
          id: 7,
          slug: 'courier',
          name: 'Courier',
          isSuperAdmin: false,
        } as RoleEntity,
        permissions: [{ key: 'orders.read' } as PermissionEntity],
      },
      {
        permissionKeys: ['orders.read', 'orders.update'],
        roleSlugs: ['courier', 'manager'],
      },
    );

    expect(result).toEqual({
      isSuperAdmin: false,
      role: { id: 7, slug: 'courier', name: 'Courier' },
      permissions: { 'orders.read': true, 'orders.update': false },
      roles: { courier: true, manager: false },
    });
  });

  it('allows super-admin permission checks without claiming other roles', () => {
    const result = service.checkAuthorization(
      {
        id: 1,
        sessionId: 'session-id',
        role: {
          id: 1,
          slug: 'super-admin',
          name: 'Super administrator',
          isSuperAdmin: true,
        } as RoleEntity,
        permissions: [],
      },
      {
        permissionKeys: ['any.dynamic.permission'],
        roleSlugs: ['super-admin', 'courier'],
      },
    );

    expect(result.permissions['any.dynamic.permission']).toBe(true);
    expect(result.roles).toEqual({
      'super-admin': true,
      courier: false,
    });
  });
});
