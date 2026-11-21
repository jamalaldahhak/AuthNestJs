import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import { AccessTokenGuard } from '../../auth/guards/access-token.guard.js';
import { PermissionsGuard } from '../../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator.js';
import { CreateRoleDto } from '../dtos/create-role.dto.js';
import { SetRolePermissionsDto } from '../dtos/set-role-permissions.dto.js';
import { UpdateRoleDto } from '../dtos/update-role.dto.js';
import { RolesService } from '../services/roles.service.js';

@Controller('roles')
@UseGuards(AccessTokenGuard, PermissionsGuard)
@RequirePermissions('roles.manage')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(id, dto);
  }

  @Put(':id/permissions')
  @RequirePermissions('roles.manage', 'permissions.manage')
  setPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetRolePermissionsDto,
  ) {
    return this.rolesService.setPermissions(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.remove(id);
  }
}
