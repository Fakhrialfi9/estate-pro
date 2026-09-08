import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';

import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter.js';
import type { AccessTokenClaims } from '../../src/common/security/access-token-verifier.port.js';
import { AuthenticatedAccessGuard } from '../../src/common/security/authenticated-access.guard.js';
import { JwtTokenService } from '../../src/modules/auth/application/services/jwt-token.service.js';

const userUuid = '123e4567-e89b-12d3-a456-426614174000';

const claims: AccessTokenClaims = {
  sub: userUuid,
  sid: 'session-1',
  iat: 1_700_000_000,
  exp: 1_800_000_000,
  jti: 'token-1',
};

const contextOf = (request: unknown): never =>
  ({
    switchToHttp: () => ({
      getRequest: <T>() => request as T,
    }),
  }) as never;

describe('roadmap final gap coverage', () => {
  it('covers the authentication guard happy and failure paths', async () => {
    const verifier = {
      verifyAccessToken: vi.fn().mockResolvedValue(claims),
    };
    const sessions = {
      isActive: vi.fn().mockResolvedValue(true),
    };
    const guard = new AuthenticatedAccessGuard(verifier, sessions);

    await expect(
      guard.canActivate(contextOf({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      guard.canActivate(contextOf({ headers: { authorization: 'Bearer ' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const request = {
      headers: { authorization: 'Bearer token' },
    };
    await expect(guard.canActivate(contextOf(request))).resolves.toBe(true);
    expect(request).toMatchObject({ user: claims });

    sessions.isActive.mockResolvedValueOnce(false);
    await expect(guard.canActivate(contextOf(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    verifier.verifyAccessToken.mockRejectedValueOnce(new Error('invalid'));
    await expect(guard.canActivate(contextOf(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('covers JWT signing and invalid token verification', async () => {
    const secret = 'test-secret-that-is-at-least-32-characters-long';
    const config = new ConfigService({
      auth: {
        jwt: {
          secret,
          issuer: 'estate-pro-api',
          audience: 'estate-pro-client',
          algorithm: 'HS256',
          expiresIn: '15m',
        },
      },
    });
    const service = new JwtTokenService(new JwtService({ secret }), config);

    const token = await service.issueAccessToken(userUuid, 'session-1');
    await expect(service.verifyAccessToken(token)).resolves.toMatchObject({
      sub: userUuid,
      sid: 'session-1',
    });
    await expect(
      service.verifyAccessToken(`${token}.tampered`),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.verifyAccessToken('invalid')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('covers unknown exception fallback in the global filter', () => {
    const logger = {
      error: vi.fn(),
      setContext: vi.fn(),
    };
    const config = {
      getOrThrow: vi.fn().mockReturnValue('test'),
    };
    const filter = new GlobalExceptionFilter(logger as never, config as never);
    const json = vi.fn();
    const response = {
      status: vi.fn(() => ({ json })),
      getHeader: vi.fn().mockReturnValue('request-1'),
    };
    const request = {
      method: 'GET',
      path: '/api/v1/unknown',
    };

    filter.catch(new Error('internal'), {
      switchToHttp: () => ({
        getResponse: <T>() => response as T,
        getRequest: <T>() => request as T,
      }),
    } as never);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error.',
      }),
    );
    expect(logger.error).toHaveBeenCalled();
  });
});
