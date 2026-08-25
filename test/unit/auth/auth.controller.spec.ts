import { describe, expect, it, vi } from 'vitest';
import { AuthController } from '../../../src/modules/auth/presentation/auth.controller.js';

describe('AuthController', () => {
  it('delegates login and returns the real authentication response', async () => {
    const login = { execute: vi.fn().mockResolvedValue({ accessToken: 'token', tokenType: 'Bearer', expiresIn: 900 }) };
    const logout = { execute: vi.fn() };
    const users = { getByUuid: vi.fn() };
    const controller = new AuthController(login as never, logout as never, users as never);
    const request = {
      ip: '127.0.0.1',
      get: vi.fn((header: string) => header === 'user-agent' ? 'vitest' : undefined),
    };

    await expect(controller.loginUser({ identifier: 'user@example.com', password: 'correct-password' }, request as never)).resolves.toEqual({
      accessToken: 'token',
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    expect(login.execute).toHaveBeenCalledOnce();
  });

  it('rejects failed authentication without exposing authentication internals', async () => {
    const login = { execute: vi.fn().mockResolvedValue(null) };
    const controller = new AuthController(login as never, { execute: vi.fn() } as never, { getByUuid: vi.fn() } as never);
    const request = { ip: '127.0.0.1', get: vi.fn() };

    await expect(controller.loginUser({ identifier: 'user@example.com', password: 'wrong-password' }, request as never)).rejects.toMatchObject({ status: 401 });
  });

  it('returns the current authenticated user through the safe serializer', async () => {
    const user = {
      uuid: '2d7c9a8c-65a0-4d72-9b9d-12a45f9bced1',
      username: 'fakhri',
      email: 'fakhri@example.com',
      phone: null,
      status: 'active',
      isActive: true,
      isVerified: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };
    const users = { getByUuid: vi.fn().mockResolvedValue(user) };
    const controller = new AuthController({ execute: vi.fn() } as never, { execute: vi.fn() } as never, users as never);

    await expect(controller.currentUser({ user: { sub: user.uuid } } as never)).resolves.toEqual({
      uuid: user.uuid,
      username: 'fakhri',
      email: 'fakhri@example.com',
      phone: null,
      status: 'active',
      isActive: true,
      isVerified: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    expect(users.getByUuid).toHaveBeenCalledWith(user.uuid);
  });
});
