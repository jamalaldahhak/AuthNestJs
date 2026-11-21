
import { Repository, ObjectLiteral } from 'typeorm';

import {
  IPaginationOptions,
  IPaginatedResult,
} from './interfaces/pagination.interface.js';

export async function paginate<T extends ObjectLiteral>(
  repository: Repository<T>,
  options: IPaginationOptions,
): Promise<IPaginatedResult<T>> {

  const page = Math.max(1, options.page || 1);

  const limit = Math.min(
    100,
    Math.max(1, options.limit || 10),
  );

  const [items, totalItems] = await repository.findAndCount({
    skip: (page - 1) * limit,
    take: limit,
  });

  return {
    items,

    meta: {
      totalItems,
      itemCount: items.length,
      itemsPerPage: limit,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    },
  };
}
