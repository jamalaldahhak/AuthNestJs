import {
  Column,
  Entity,
  Index,
  ManyToMany,
} from 'typeorm';

import { BaseEntity } from '../../../database/base.entity.js';
import { RoleEntity } from './role.entity.js';

@Entity('permissions')
@Index('IDX_PERMISSIONS_KEY', ['key'], { unique: true })
export class PermissionEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 120 })
  key: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToMany(() => RoleEntity, (role) => role.permissions)
  roles: RoleEntity[];
}
