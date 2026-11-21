import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuthSessionEntity } from '../models/auth-session.entity.js';
import { SessionStatus } from '../constants/session-status.enum.js';
import { UserEntity } from '../../users/models/user.entity.js';
import { UserStatus } from '../../users/constants/user-status.enum.js';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface.js';
import { JwtPayload } from '../interfaces/jwt-payload.interface.js';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const [scheme, token, ...extra] =
      typeof authorization === 'string'
        ? authorization.split(' ')
        : [];

    if (
      scheme?.toLowerCase() !== 'bearer' ||
      !token ||
      extra.length > 0
    ) {
      throw new UnauthorizedException('Bearer access token required');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    if (
      payload.type !== 'access' ||
      !Number.isInteger(payload.sub) ||
      payload.sub < 1 ||
      typeof payload.sid !== 'string'
    ) {
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin(
        AuthSessionEntity,
        'session',
        `session.userId = user.id
          AND session.sessionId = :sessionId
          AND session.status = :sessionStatus
          AND session.expiresAt > :now`,
        {
          sessionId: payload.sid,
          sessionStatus: SessionStatus.ACTIVE,
          now: new Date(),
        },
      )
      .leftJoinAndSelect('user.userRole', 'userRole')
      .leftJoinAndSelect('userRole.role', 'role')
      .leftJoinAndSelect('role.permissions', 'rolePermission')
      .leftJoinAndSelect('user.permissions', 'userPermission')
      .where('user.id = :userId', { userId: payload.sub })
      .andWhere('user.status = :userStatus', {
        userStatus: UserStatus.ACTIVE,
      })
      .getOne();

    if (!user || !user.userRole?.role?.isActive) {
      throw new UnauthorizedException('Account is not active');
    }
    const role = user.userRole.role;

    request.authUser = {
      id: user.id,
      sessionId: payload.sid,
      role,
      permissions: user.permissions.filter(
        (permission) =>
          permission.isActive &&
          role.permissions.some(
            (rolePermission) =>
              rolePermission.id === permission.id &&
              rolePermission.isActive,
          ),
      ),
    };

    return true;
  }
}
