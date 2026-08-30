import { describe, expect, it } from 'vitest';
import { RefreshTokenCryptoService, REFRESH_TOKEN_BYTE_LENGTH, REFRESH_TOKEN_STRING_LENGTH } from '../../../src/modules/auth/application/services/refresh-token-crypto.service.js';

describe('RefreshTokenCryptoService', () => {
  it('generates 256-bit opaque base64url tokens', () => {
    const service = new RefreshTokenCryptoService();
    const token = service.generate();
    expect(token).toHaveLength(REFRESH_TOKEN_STRING_LENGTH);
    expect(Buffer.from(token, 'base64url')).toHaveLength(REFRESH_TOKEN_BYTE_LENGTH);
    expect(token).not.toMatch(/^eyJ/);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates unique token values', () => {
    const service = new RefreshTokenCryptoService();
    expect(new Set(Array.from({ length: 100 }, () => service.generate())).size).toBe(100);
  });

  it('stores a deterministic 32-byte sha256 digest', () => {
    const service = new RefreshTokenCryptoService();
    const token = service.generate();
    const digest = service.digest(token);
    expect(digest).toHaveLength(64);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(service.digest(token)).toBe(digest);
  });

  it('supports constant-time digest equality', () => {
    const service = new RefreshTokenCryptoService();
    const digest = service.digest(service.generate());
    expect(service.equalsDigest(digest, digest)).toBe(true);
    expect(service.equalsDigest(digest, service.digest(service.generate()))).toBe(false);
  });
});
