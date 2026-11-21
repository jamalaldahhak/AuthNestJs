
import {
  DeepPartial,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
} from 'typeorm';

import { IBaseRepository } from './base.repository.interface.js';
import { IIdentifiable } from './identifiable.interface.js';

export abstract class BaseRepository<
  T extends ObjectLiteral & IIdentifiable
> implements IBaseRepository<T> {

  protected constructor(
    protected readonly repository: Repository<T>,
  ) {}

  async create(data: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findAll(): Promise<T[]> {
    return this.repository.find();
  }

  async findById(id: number): Promise<T | null> {
    return this.repository.findOne({
      where: { id } as FindOptionsWhere<T>,
    });
  }

  async findOne(
    conditions: FindOptionsWhere<T>,
  ): Promise<T | null> {
    return this.repository.findOne({
      where: conditions,
    });
  }

  async update(
    id: number,
    data: DeepPartial<T>,
  ): Promise<T | null> {
    const entity = await this.findById(id);

    if (!entity) return null;

    const updatedEntity = this.repository.merge(
      entity,
      data,
    );

    return this.repository.save(updatedEntity);
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.repository.delete(id);

    return (result.affected ?? 0) > 0;
  }

  async count(): Promise<number> {
    return this.repository.count();
  }
}
