import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
} from 'typeorm';
import type { Relation } from 'typeorm';

import { BaseEntity } from '../../../database/base.entity.js';
import { RoleEntity } from '../../authorization/models/role.entity.js';
import { UserEntity } from './user.entity.js';

@Entity('user_roles')
@Index('IDX_USER_ROLES_USER_ID', ['userId'], { unique: true })
@Index('IDX_USER_ROLES_ROLE_ID', ['roleId'])
export class UserRoleEntity extends BaseEntity {
  @Column({ type: 'int' })
  userId: number;

  @OneToOne(() => UserEntity, (user) => user.userRole, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: Relation<UserEntity>;

  @Column({ type: 'int' })
  roleId: number;

  @ManyToOne(() => RoleEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'roleId' })
  role: Relation<RoleEntity>;
}
