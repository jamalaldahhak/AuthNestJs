import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';

import { BaseEntity } from '../../../database/base.entity.js';
import { UserEntity } from '../../users/models/user.entity.js';
import { SessionStatus } from '../constants/session-status.enum.js';

@Entity('auth_sessions')
@Index('IDX_AUTH_SESSIONS_SESSION_ID', ['sessionId'], { unique: true })
@Index('IDX_AUTH_SESSIONS_USER_ID', ['userId'])
@Index('IDX_AUTH_SESSIONS_STATUS', ['status'])
export class AuthSessionEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 36 })
  sessionId: string;

  @Column({ type: 'int' })
  userId: number;

  @Column({
    type: 'varchar',
    length: 255,
    select: false,
  })
  refreshTokenHash: string;

  @Column({
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.ACTIVE,
  })
  status: SessionStatus;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Column({ type: 'datetime', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  lastUsedAt: Date | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  replacedBySessionId: string | null;

  @ManyToOne(() => UserEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;
}