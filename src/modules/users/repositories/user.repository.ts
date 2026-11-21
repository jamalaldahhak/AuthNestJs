
import { Injectable } from '@nestjs/common';

import {
  InjectRepository,
} from '@nestjs/typeorm';

import {
  DataSource,
  Repository,
} from 'typeorm';

import { BaseRepository } from '../../../database/base.repository.js';
import { UserEntity } from '../models/user.entity.js';
import { UserRoleEntity } from '../models/user-role.entity.js';
import { UserStatus } from '../constants/user-status.enum.js';
import { AuthSessionEntity } from '../../auth/models/auth-session.entity.js';
import { SessionStatus } from '../../auth/constants/session-status.enum.js';
import type { PermissionEntity } from '../../authorization/models/permission.entity.js';

@Injectable()
export class UserRepository extends BaseRepository<UserEntity> {

  constructor(
    @InjectRepository(UserEntity)
    repository: Repository<UserEntity>,
    private readonly dataSource: DataSource,
  ) {
    super(repository);
  }

  async findAdminPage(page: number, limit: number) {
    return this.repository.findAndCount({
      relations: {
        userRole: { role: { permissions: true } },
        permissions: true,
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  replaceUserPermissions(
    id: number,
    permissions: PermissionEntity[],
  ): Promise<UserEntity | null> {
    return this.dataSource.transaction(async (manager) => {
      const users = manager.getRepository(UserEntity);
      const user = await users.findOne({
        where: { id },
        relations: { permissions: true },
      });
      if (!user) {
        return null;
      }

      user.permissions = permissions;
      await users.save(user);

      return users.findOne({
        where: { id },
        relations: {
          userRole: { role: { permissions: true } },
          permissions: true,
        },
      });
    });
  }

  async removeRolePermissionsFromUsers(
    roleId: number,
    allowedPermissionIds: number[],
  ): Promise<void> {
    const roleUsers = `
      userId IN (SELECT userId FROM user_roles WHERE roleId = ?)
    `;

    if (allowedPermissionIds.length === 0) {
      await this.dataSource.query(
        `DELETE FROM user_permissions WHERE ${roleUsers}`,
        [roleId],
      );
      return;
    }

    const placeholders = allowedPermissionIds.map(() => '?').join(', ');
    await this.dataSource.query(
      `DELETE FROM user_permissions
       WHERE ${roleUsers}
         AND permissionId NOT IN (${placeholders})`,
      [roleId, ...allowedPermissionIds],
    );
  }

  findAdminById(id: number): Promise<UserEntity | null> {
    return this.repository.findOne({
      where: { id },
      relations: {
        userRole: { role: { permissions: true } },
        permissions: true,
      },
    });
  }

  countByRoleId(roleId: number): Promise<number> {
    return this.dataSource
      .getRepository(UserRoleEntity)
      .count({ where: { roleId } });
  }

  countMissingRoleIdentifier(
    roleId: number,
    column: 'email' | 'phone',
  ): Promise<number> {
    return this.repository
      .createQueryBuilder('user')
      .innerJoin('user.userRole', 'userRole')
      .where('userRole.roleId = :roleId', { roleId })
      .andWhere(
        column === 'email'
          ? '(user.email IS NULL OR user.email = \'\')'
          : '(user.phone IS NULL OR user.phone = \'\')',
      )
      .getCount();
  }

  async updateAdminUser(
    id: number,
    changes: Partial<UserEntity>,
    roleId: number,
    revokeSessions: boolean,
  ): Promise<UserEntity | null> {
    return this.dataSource.transaction(async (manager) => {
      const users = manager.getRepository(UserEntity);
      const userRoles = manager.getRepository(UserRoleEntity);
      const sessions = manager.getRepository(AuthSessionEntity);
      const user = await users.findOne({
        where: { id },
        relations: { userRole: true },
      });
      if (!user) {
        return null;
      }

      const roleChanged = roleId !== user.userRole?.roleId;
      users.merge(user, changes);
      if (roleChanged) {
        await manager.query(
          'DELETE FROM user_permissions WHERE userId = ?',
          [id],
        );
      }
      await users.save(user);

      if (roleChanged) {
        const userRole = user.userRole ?? userRoles.create({ userId: id });
        userRole.roleId = roleId;
        await userRoles.save(userRole);
      }

      if (revokeSessions) {
        await sessions.update(
          { userId: id, status: SessionStatus.ACTIVE },
          {
            status: SessionStatus.REVOKED,
            revokedAt: new Date(),
          },
        );
      }

      return users.findOne({
        where: { id },
        relations: {
          userRole: { role: { permissions: true } },
          permissions: true,
        },
      });
    });
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.repository.findOne({
      where: {
        email: email.toLowerCase().trim(),
      },
    });
  }

  async findByPhone(phone: string): Promise<UserEntity | null> {
    return this.repository.findOne({
      where: { phone },
    });
  }

  async findByEmailWithPassword(
    email: string,
  ): Promise<UserEntity | null> {
    return this.repository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.userRole', 'userRole')
      .leftJoinAndSelect('userRole.role', 'role')
      .leftJoinAndSelect('role.permissions', 'rolePermission')
      .leftJoinAndSelect('user.permissions', 'userPermission')
      .where('user.email = :email', {
        email: email.toLowerCase().trim(),
      })
      .getOne();
  }

  async findByPhoneWithPassword(
    phone: string,
  ): Promise<UserEntity | null> {
    return this.repository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.userRole', 'userRole')
      .leftJoinAndSelect('userRole.role', 'role')
      .leftJoinAndSelect('role.permissions', 'rolePermission')
      .leftJoinAndSelect('user.permissions', 'userPermission')
      .where('user.phone = :phone', { phone })
      .getOne();
  }

  findProfileById(id: number): Promise<UserEntity | null> {
    return this.repository.findOne({
      where: { id },
      relations: {
        userRole: { role: { permissions: true } },
        permissions: true,
      },
    });
  }

  async createUser(data: {
    firstName: string;
    lastName: string;
    email?: string | null;
    passwordHash: string;
    phone?: string | null;
    roleId: number;
    permissions?: PermissionEntity[];
  }): Promise<UserEntity> {
    const { roleId, ...userData } = data;
    return this.dataSource.transaction(async (manager) => {
      const users = manager.getRepository(UserEntity);
      const userRoles = manager.getRepository(UserRoleEntity);
      const user = await users.save(
        users.create({
          ...userData,
          email: data.email?.toLowerCase().trim() ?? null,
          phone: data.phone ?? null,
          status: UserStatus.ACTIVE,
        }),
      );

      await userRoles.save({
        userId: user.id,
        roleId,
      });

      return user;
    });
  }
}
