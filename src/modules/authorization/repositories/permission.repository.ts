import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BaseRepository } from '../../../database/base.repository.js';
import { PermissionEntity } from '../models/permission.entity.js';

@Injectable()
export class PermissionRepository extends BaseRepository<PermissionEntity> {
  constructor(
    @InjectRepository(PermissionEntity)
    repository: Repository<PermissionEntity>,
  ) {
    super(repository);
  }

  findByKey(key: string): Promise<PermissionEntity | null> {
    return this.repository.findOne({ where: { key } });
  }

  findByIds(ids: number[]): Promise<PermissionEntity[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }

    return this.repository
      .createQueryBuilder('permission')
      .where('permission.id IN (:...ids)', { ids })
      .getMany();
  }
}
