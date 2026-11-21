import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';

import { BaseRepository } from '../../../database/base.repository.js';
import { AuthSessionEntity } from '../models/auth-session.entity.js';
import { SessionStatus } from '../constants/session-status.enum.js';

@Injectable()
export class AuthSessionRepository extends BaseRepository<AuthSessionEntity> {
  constructor(
    @InjectRepository(AuthSessionEntity)
    repository: Repository<AuthSessionEntity>,
  ) {
    super(repository);
  }

  async findBySessionIdWithHash(
    sessionId: string,
  ): Promise<AuthSessionEntity | null> {
    return this.repository
      .createQueryBuilder('session')
      .addSelect('session.refreshTokenHash')
      .where('session.sessionId = :sessionId', { sessionId })
      .getOne();
  }

  async revokeBySessionId(sessionId: string): Promise<void> {
    await this.repository.update(
      {
        sessionId,
        status: SessionStatus.ACTIVE,
      },
      {
        status: SessionStatus.REVOKED,
        revokedAt: new Date(),
      },
    );
  }

  async revokeAllByUserId(userId: number): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update()
      .set({
        status: SessionStatus.REVOKED,
        revokedAt: new Date(),
      })
      .where('userId = :userId', { userId })
      .andWhere('status = :status', {
        status: SessionStatus.ACTIVE,
      })
      .execute();
  }

  async countActiveByUserId(userId: number): Promise<number> {
    return this.repository.count({
      where: {
        userId,
        status: SessionStatus.ACTIVE,
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  async rotateRefreshToken(
    sessionId: string,
    currentHash: string,
    nextHash: string,
    expiresAt: Date,
  ): Promise<boolean> {
    const result = await this.repository.update(
      {
        sessionId,
        status: SessionStatus.ACTIVE,
        refreshTokenHash: currentHash,
      },
      {
        refreshTokenHash: nextHash,
        expiresAt,
        lastUsedAt: new Date(),
      },
    );

    return (result.affected ?? 0) === 1;
  }
}