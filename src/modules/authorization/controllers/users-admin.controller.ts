import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AccessTokenGuard } from '../../auth/guards/access-token.guard.js';
import { PermissionsGuard } from '../../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator.js';
import { CreateUserDto } from '../dtos/create-user.dto.js';
import { UpdateUserDto } from '../dtos/update-user.dto.js';
import { SetUserPermissionsDto } from '../dtos/set-user-permissions.dto.js';
import { UsersAdminService } from '../services/users-admin.service.js';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface.js';

@Controller('users')
@UseGuards(AccessTokenGuard, PermissionsGuard)
export class UsersAdminController {
  constructor(private readonly usersService: UsersAdminService) {}

  @Get()
  @RequirePermissions('users.read')
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.usersService.findAll(page, limit);
  }

  @Get(':id')
  @RequirePermissions('users.read')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findById(id);
  }

  @Post()
  @RequirePermissions(
    'users.create',
    'users.assign-role',
    'users.permissions.manage',
  )
  create(
    @Body() dto: CreateUserDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const user = request.authUser!;
    return this.usersService.create(
      dto,
      user.role.isSuperAdmin,
      user.role.isSuperAdmin ||
        user.permissions.some(
          (permission) => permission.key === 'users.assign-role',
        ),
      user.role.isSuperAdmin ||
        user.permissions.some(
          (permission) => permission.key === 'users.permissions.manage',
        ),
    );
  }

  @Patch(':id')
  @RequirePermissions('users.update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const user = request.authUser!;
    return this.usersService.update(
      id,
      dto,
      user.role.isSuperAdmin,
      user.role.isSuperAdmin ||
        user.permissions.some(
          (permission) => permission.key === 'users.assign-role',
        ),
    );
  }

  @Put(':id/permissions')
  @RequirePermissions('users.permissions.manage')
  replacePermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetUserPermissionsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.replacePermissions(
      id,
      dto.permissionIds,
      request.authUser!.role.isSuperAdmin,
    );
  }
}
