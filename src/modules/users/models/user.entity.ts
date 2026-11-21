
import {
  Column,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  OneToOne,
} from 'typeorm';
import type { Relation } from 'typeorm';

import { BaseEntity } from '../../../database/base.entity.js';
import { UserStatus } from '../constants/user-status.enum.js';
import { PermissionEntity } from '../../authorization/models/permission.entity.js';
import { UserRoleEntity } from './user-role.entity.js';

@Entity('users')
@Index('IDX_USERS_EMAIL', ['email'], { unique: true })
@Index('IDX_USERS_PHONE', ['phone'], { unique: true })
export class UserEntity extends BaseEntity {

  @Column({
    type: 'varchar',
    length: 100,
  })
  firstName: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  lastName: string;

  @Column({
    type: 'varchar',
    length: 190,
    nullable: true,
  })
  email: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    select: false,
  })
  passwordHash: string;

  @Column({
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  phone: string | null;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @OneToOne(() => UserRoleEntity, (userRole) => userRole.user)
  userRole: Relation<UserRoleEntity>;

  @ManyToMany(() => PermissionEntity)
  @JoinTable({
    name: 'user_permissions',
    joinColumn: { name: 'userId', referencedColumnName: 'id' },
    inverseJoinColumn: {
      name: 'permissionId',
      referencedColumnName: 'id',
    },
  })
  permissions: PermissionEntity[];

  @Column({
    type: 'datetime',
    nullable: true,
  })
  lastLoginAt: Date | null;
}
