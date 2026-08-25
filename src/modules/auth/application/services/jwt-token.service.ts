import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

export interface AccessTokenClaims {
  sub: string;
  sid: string;
  iat: number;
  exp: number;
  permissions?: string[];
  iss?: string;
  aud?: string | string[];
}

type SupportedAlgorithm = 'HS256' | 'HS384' | 'HS512';

type TokenPayload = JwtPayload & Partial<AccessTokenClaims>;

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async issueAccessToken(userUuid: string, sessionId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userUuid, sid: sessionId },
      this.getSignOptions(),
    );
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    try {
      const claims = await this.jwt.verifyAsync<AccessTokenClaims>(token, {
        secret: this.getSecret(),
        issuer: this.getIssuer(),
        audience: this.getAudience(),
        algorithms: [this.getAlgorithm()],
      });
      if (!claims.sub || !claims.sid || !claims.iat || !claims.exp) {
        throw new UnauthorizedException();
      }
      return claims;
    } catch {
      throw new UnauthorizedException('Invalid authentication token');
    }
  }

  getExpiresAt(token: string): Date {
    const payload = this.jwt.decode<TokenPayload>(token);
    if (!payload || typeof payload !== 'object' || typeof payload.exp !== 'number') {
      throw new UnauthorizedException('Invalid authentication token');
    }
    return new Date(payload.exp * 1000);
  }

  private getSignOptions() {
    return {
      expiresIn: this.config.getOrThrow<string>('auth.jwt.expiresIn'),
      issuer: this.getIssuer(),
      audience: this.getAudience(),
      algorithm: this.getAlgorithm(),
    } as const;
  }

  private getSecret(): string {
    return this.config.getOrThrow<string>('auth.jwt.secret');
  }

  private getIssuer(): string {
    return this.config.getOrThrow<string>('auth.jwt.issuer');
  }

  private getAudience(): string {
    return this.config.getOrThrow<string>('auth.jwt.audience');
  }

  private getAlgorithm(): SupportedAlgorithm {
    const algorithm = this.config.getOrThrow<string>('auth.jwt.algorithm');
    if (algorithm !== 'HS256' && algorithm !== 'HS384' && algorithm !== 'HS512') {
      throw new Error('Unsupported JWT algorithm');
    }
    return algorithm;
  }
}
