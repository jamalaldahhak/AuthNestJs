import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BaseRepository } from '../../../database/base.repository.js';
import { RoleEntity } from '../models/role.entity.js';

@Injectable()
export class RoleRepository extends BaseRepository<RoleEntity> {
  constructor(
    @InjectRepository(RoleEntity)
    repository: Repository<RoleEntity>,
  ) {
    super(repository);
  }

  findBySlug(slug: string): Promise<RoleEntity | null> {
    return this.repository.findOne({
      where: { slug },
      relations: { permissions: true },
    });
  }

  findActiveBySlug(slug: string): Promise<RoleEntity | null> {
    return this.repository.findOne({
      where: { slug, isActive: true },
      relations: { permissions: true },
    });
  }

  findActiveById(id: number): Promise<RoleEntity | null> {
    return this.repository.findOne({
      where: { id, isActive: true },
      relations: { permissions: true },
    });
  }

  findWithPermissionsById(id: number): Promise<RoleEntity | null> {
    return this.repository.findOne({
      where: { id },
      relations: { permissions: true },
    });
  }

  findAllWithPermissions(): Promise<RoleEntity[]> {
    return this.repository.find({
      relations: { permissions: true },
      order: { name: 'ASC' },
    });
  }

  save(role: RoleEntity): Promise<RoleEntity> {
    return this.repository.save(role);
  }

  findActiveLoginOptions(): Promise<RoleEntity[]> {
    return this.repository.find({
      where: { isActive: true },
      select: {
        id: true,
        slug: true,
        name: true,
        loginMethod: true,
        selfRegistrationEnabled: true,
      },
      order: { name: 'ASC' },
    });
  }
}
