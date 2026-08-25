import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import type { AccessTokenClaims } from '../../../../common/security/access-token-verifier.port.js';

export type { AccessTokenClaims } from '../../../../common/security/access-token-verifier.port.js';

type SupportedAlgorithm = 'HS256' | 'HS384' | 'HS512';
type RequiredExpiresIn = Exclude<SignOptions['expiresIn'], undefined>;

export interface MfaChallengeClaims {
  sub: string;
  challengeId: string;
  purpose: 'mfa-challenge';
  iat: number;
  exp: number;
}

@Injectable()
export class JwtTokenService {
  constructor(private readonly jwt: JwtService, private readonly config: ConfigService) {}

  async issueAccessToken(userUuid: string, sessionId: string): Promise<string> {
    return this.jwt.signAsync({ sub: userUuid, sid: sessionId }, this.getSignOptions());
  }

  async issueMfaChallenge(userUuid: string, challengeId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userUuid, challengeId, purpose: 'mfa-challenge' },
      { ...this.getBaseSignOptions(), expiresIn: this.getMfaChallengeTtl() as RequiredExpiresIn },
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
      if (!claims.sub || !claims.sid || !claims.iat || !claims.exp) throw new UnauthorizedException();
      return claims;
    } catch {
      throw new UnauthorizedException('Invalid authentication token');
    }
  }

  async verifyMfaChallenge(token: string): Promise<MfaChallengeClaims> {
    try {
      const claims = await this.jwt.verifyAsync<MfaChallengeClaims>(token, {
        secret: this.getSecret(),
        issuer: this.getIssuer(),
        audience: this.getAudience(),
        algorithms: [this.getAlgorithm()],
      });
      if (!claims.sub || !claims.challengeId || claims.purpose !== 'mfa-challenge' || !claims.iat || !claims.exp) throw new UnauthorizedException();
      return claims;
    } catch {
      throw new UnauthorizedException('Invalid or expired two-factor challenge');
    }
  }

  getExpiresAt(token: string): Date {
    const payload = this.jwt.decode<AccessTokenClaims>(token);
    if (!payload || typeof payload !== 'object' || typeof payload.exp !== 'number') throw new UnauthorizedException('Invalid authentication token');
    return new Date(payload.exp * 1000);
  }

  private getSignOptions(): SignOptions {
    return { ...this.getBaseSignOptions(), expiresIn: this.config.getOrThrow<string>('auth.jwt.expiresIn') as RequiredExpiresIn };
  }

  private getBaseSignOptions(): SignOptions {
    return { issuer: this.getIssuer(), audience: this.getAudience(), algorithm: this.getAlgorithm() };
  }

  private getMfaChallengeTtl(): string {
    const ttlMs = this.config.get<number>('auth.twoFactor.challengeTtlMs', 300000);
    return `${Math.floor(ttlMs / 1000)}s`;
  }

  private getSecret(): string { return this.config.getOrThrow<string>('auth.jwt.secret'); }
  private getIssuer(): string { return this.config.getOrThrow<string>('auth.jwt.issuer'); }
  private getAudience(): string { return this.config.getOrThrow<string>('auth.jwt.audience'); }

  private getAlgorithm(): SupportedAlgorithm {
    const algorithm = this.config.getOrThrow<string>('auth.jwt.algorithm');
    if (algorithm !== 'HS256' && algorithm !== 'HS384' && algorithm !== 'HS512') throw new Error('Unsupported JWT algorithm');
    return algorithm;
  }
}
