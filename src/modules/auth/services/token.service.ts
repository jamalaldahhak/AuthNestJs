
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID, createHash } from 'crypto';

import { AuthSessionRepository } from '../repositories/auth-session.repository.js';
import { JwtPayload } from '../interfaces/jwt-payload.interface.js';
import { AuthTokens } from '../interfaces/auth-tokens.interface.js';
import { SessionStatus } from '../constants/session-status.enum.js';
import { parseJwtDuration } from '../utils/jwt-duration.js';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionRepository: AuthSessionRepository,
  ) {}

  async createSession(
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthTokens> {
    const sessionId = randomUUID();
    const { tokens, refreshTokenHash, expiresAt } =
      await this.issueTokens(userId, sessionId);

    await this.sessionRepository.create({
      sessionId,
      userId,
      refreshTokenHash,
      status: SessionStatus.ACTIVE,
      expiresAt,
      revokedAt: null,
      lastUsedAt: null,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent?.slice(0, 500) ?? null,
      replacedBySessionId: null,
    });

    return tokens;
  }

  async rotateRefreshToken(
    userId: number,
    sessionId: string,
    currentTokenHash: string,
  ): Promise<AuthTokens | null> {
    const { tokens, refreshTokenHash, expiresAt } =
      await this.issueTokens(userId, sessionId);

    const rotated = await this.sessionRepository.rotateRefreshToken(
      sessionId,
      currentTokenHash,
      refreshTokenHash,
      expiresAt,
    );

    return rotated ? tokens : null;
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueTokens(
    userId: number,
    sessionId: string,
  ): Promise<{
    tokens: AuthTokens;
    refreshTokenHash: string;
    expiresAt: Date;
  }> {
    const accessTtl = this.configService.getOrThrow<string>(
      'JWT_ACCESS_EXPIRES_IN',
    );
    const refreshTtl = this.configService.getOrThrow<string>(
      'JWT_REFRESH_EXPIRES_IN',
    );
    const accessTtlSeconds = parseJwtDuration(accessTtl);
    const refreshTtlSeconds = parseJwtDuration(refreshTtl);

    if (refreshTtlSeconds <= accessTtlSeconds) {
      throw new Error('Invalid JWT expiration configuration');
    }

    const accessPayload: JwtPayload = {
      sub: userId,
      sid: sessionId,
      type: 'access',
    };
    const refreshPayload: JwtPayload = {
      sub: userId,
      sid: sessionId,
      type: 'refresh',
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.configService.getOrThrow<string>(
        'JWT_ACCESS_SECRET',
      ),
      algorithm: 'HS256',
      expiresIn: accessTtlSeconds,
    });
    const refreshToken = await this.jwtService.signAsync(
      refreshPayload,
      {
        secret: this.configService.getOrThrow<string>(
          'JWT_REFRESH_SECRET',
        ),
        algorithm: 'HS256',
        expiresIn: refreshTtlSeconds,
      },
    );

    return {
      tokens: {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: accessTtlSeconds,
      },
      refreshTokenHash: this.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + refreshTtlSeconds * 1000),
    };
  }

}
