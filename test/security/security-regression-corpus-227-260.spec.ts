import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RefreshTokenCryptoService } from '../../src/modules/auth/application/services/refresh-token-crypto.service.js';
import { SessionService } from '../../src/modules/auth/application/services/session.service.js';
import { JwtTokenService } from '../../src/modules/auth/application/services/jwt-token.service.js';

const JWT_SECRET = 'security-regression-secret-012345678901234567890';
const USER = '7e9d9c67-30a5-4d2c-a8df-70755f96ad35';

function jwtVerifier(): JwtTokenService {
  const config = new ConfigService({
    auth: {
      jwt: {
        secret: JWT_SECRET,
        issuer: 'estate-pro-api',
        audience: 'estate-pro-client',
        algorithm: 'HS256',
        expiresIn: '15m',
      },
    },
  });
  return new JwtTokenService(new JwtService({ secret: JWT_SECRET }), config);
}

describe('Security regression corpus — STEPS 227–260', () => {
  it('regression: refresh credentials are high-entropy opaque values and never equal their digest', () => {
    const crypto = new RefreshTokenCryptoService();
    const token = crypto.generate();
    const digest = crypto.digest(token);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toBe(token);
    expect(crypto.equalsDigest(digest, digest)).toBe(true);
    expect(crypto.equalsDigest(digest, crypto.digest(crypto.generate()))).toBe(
      false,
    );
  });

  it('regression: session secrets are stored as deterministic SHA-256 digests', () => {
    const secret = 'regression-session-secret';
    const digest = SessionService.digestSecret(secret);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).toBe(SessionService.digestSecret(secret));
    expect(digest).not.toBe(secret);
  });

  it('regression: JWT verification rejects algorithm confusion', async () => {
    const confused = await new JwtService({ secret: JWT_SECRET }).signAsync(
      { sub: USER, sid: 'session' },
      {
        secret: JWT_SECRET,
        algorithm: 'HS384',
        issuer: 'estate-pro-api',
        audience: 'estate-pro-client',
        expiresIn: '60s',
      },
    );
    await expect(jwtVerifier().verifyAccessToken(confused)).rejects.toThrow();
  });
});
