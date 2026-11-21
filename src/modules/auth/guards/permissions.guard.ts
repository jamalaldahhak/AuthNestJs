import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator.js';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<
      string[] | undefined
    >(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    const user = request.authUser;

    if (!user) {
      throw new ForbiddenException('Authentication is required');
    }

    if (user.role.isSuperAdmin) {
      return true;
    }

    const granted = new Set(user.permissions.map(({ key }) => key));
    if (!requiredPermissions.every((permission) => granted.has(permission))) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
