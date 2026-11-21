import type { Request } from 'express';

import { PermissionEntity } from '../../authorization/models/permission.entity.js';
import { RoleEntity } from '../../authorization/models/role.entity.js';

export interface AuthenticatedUser {
  id: number;
  sessionId: string;
  role: RoleEntity;
  permissions: PermissionEntity[];
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUser;
}
