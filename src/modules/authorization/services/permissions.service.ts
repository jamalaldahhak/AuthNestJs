import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CreatePermissionDto } from '../dtos/create-permission.dto.js';
import { UpdatePermissionDto } from '../dtos/update-permission.dto.js';
import { PermissionRepository } from '../repositories/permission.repository.js';
import { isDuplicateEntry } from '../../../database/is-duplicate-entry.js';

@Injectable()
export class PermissionsService {
  constructor(
    private readonly permissionRepository: PermissionRepository,
  ) {}

  findAll() {
    return this.permissionRepository.findAll();
  }

  async findById(id: number) {
    const permission = await this.permissionRepository.findById(id);
    if (!permission) {
      throw new NotFoundException({
        errorCode: 'PERMISSION_NOT_FOUND',
        message: 'Permission not found',
      });
    }

    return permission;
  }

  async create(dto: CreatePermissionDto) {
    if (await this.permissionRepository.findByKey(dto.key)) {
      throw new ConflictException({
        errorCode: 'PERMISSION_KEY_ALREADY_EXISTS',
        message: 'A permission with this key already exists',
      });
    }

    try {
      return await this.permissionRepository.create({
        ...dto,
        description: dto.description ?? null,
        isActive: true,
      });
    } catch (error: unknown) {
      if (isDuplicateEntry(error)) {
        throw new ConflictException({
          errorCode: 'PERMISSION_KEY_ALREADY_EXISTS',
          message: 'A permission with this key already exists',
        });
      }

      throw error;
    }
  }

  async update(id: number, dto: UpdatePermissionDto) {
    const updated = await this.permissionRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException({
        errorCode: 'PERMISSION_NOT_FOUND',
        message: 'Permission not found',
      });
    }

    return updated;
  }

  async remove(id: number): Promise<{ message: string }> {
    await this.findById(id);
    await this.permissionRepository.delete(id);
    return { message: 'Permission deleted successfully' };
  }
}
