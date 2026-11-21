import { Injectable } from '@nestjs/common';

import { AuthSessionRepository } from '../repositories/auth-session.repository.js';

@Injectable()
export class SessionService {
  constructor(
    private readonly sessionRepository: AuthSessionRepository,
  ) {}

  async revokeSession(sessionId: string): Promise<void> {
    await this.sessionRepository.revokeBySessionId(sessionId);
  }

  async revokeAllUserSessions(userId: number): Promise<void> {
    await this.sessionRepository.revokeAllByUserId(userId);
  }
}