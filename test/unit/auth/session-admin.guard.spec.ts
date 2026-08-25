import { describe, expect, it } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { SessionAdminGuard } from '../../../src/modules/auth/security/session-admin.guard.js';

function context(permissions?: string[]): ExecutionContext {
  const request = { user: permissions ? { sub: 'u', sid: 's', permissions, iat: 1, exp: 2 } : undefined };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('SessionAdminGuard', () => {
  it('rejects a regular authenticated user', () => {
    expect(() => new SessionAdminGuard().canActivate(context([]))).toThrow();
  });

  it('allows an authenticated principal with the session-management permission', () => {
    expect(new SessionAdminGuard().canActivate(context(['sessions:manage']))).toBe(true);
  });
});
