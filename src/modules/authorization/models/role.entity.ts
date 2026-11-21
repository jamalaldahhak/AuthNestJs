import {
  Column,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
} from 'typeorm';

import { BaseEntity } from '../../../database/base.entity.js';
import { LoginMethod } from '../constants/login-method.enum.js';
import { PermissionEntity } from './permission.entity.js';

@Entity('roles')
@Index('IDX_ROLES_SLUG', ['slug'], { unique: true })
export class RoleEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 80 })
  slug: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: LoginMethod, default: LoginMethod.EMAIL })
  loginMethod: LoginMethod;

  @Column({ type: 'boolean', default: false })
  selfRegistrationEnabled: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isSystem: boolean;

  @Column({ type: 'boolean', default: false })
  isSuperAdmin: boolean;

  @ManyToMany(() => PermissionEntity, (permission) => permission.roles)
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'roleId', referencedColumnName: 'id' },
    inverseJoinColumn: {
      name: 'permissionId',
      referencedColumnName: 'id',
    },
  })
  permissions: PermissionEntity[];
}
