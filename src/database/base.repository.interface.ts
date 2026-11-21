
import { DeepPartial, FindOptionsWhere } from 'typeorm';
import { IIdentifiable } from './identifiable.interface.js';

export interface IBaseRepository<T extends IIdentifiable> {
  create(data: DeepPartial<T>): Promise<T>;

  findAll(): Promise<T[]>;

  findById(id: number): Promise<T | null>;

  findOne(
    conditions: FindOptionsWhere<T>,
  ): Promise<T | null>;

  update(
    id: number,
    data: DeepPartial<T>,
  ): Promise<T | null>;

  delete(id: number): Promise<boolean>;

  count(): Promise<number>;
}
