import { describe, expect, it } from 'vitest';

import {
  AnalyticsInvalidQueryException,
  AnalyticsQueryTimeoutException,
  AnalyticsScopeException,
  AnalyticsUnavailableException,
} from '../../src/modules/analytics/domain/errors/analytics.errors.js';
import {
  RefreshTokenExpiredError,
  RefreshTokenInvalidError,
  RefreshTokenRevokedError,
  RefreshTokenReuseDetectedError,
  RefreshTokenSessionInvalidError,
  isRefreshTokenRevokeReason,
} from '../../src/modules/auth/domain/errors/refresh-token.errors.js';
import {
  ForbiddenPermissionOperationException,
  InvalidPermissionException,
  PermissionAlreadyExistsException,
  PermissionDeleteNotAllowedException,
  PermissionInUseException,
  PermissionNotFoundException,
  PermissionResourceActionAlreadyExistsException,
  PermissionUpdateNotAllowedException,
  SystemPermissionProtectedException,
  UnauthorizedPermissionOperationException,
} from '../../src/modules/permissions/domain/errors/permission.errors.js';
import {
  ForbiddenRoleOperationException,
  InvalidRoleException,
  RoleAlreadyExistsException,
  RoleCodeAlreadyExistsException,
  RoleDeleteNotAllowedException,
  RoleInUseException,
  RoleNotFoundException,
  RoleUpdateNotAllowedException,
  SystemRoleProtectedException,
  UnauthorizedRoleOperationException,
} from '../../src/modules/roles/domain/errors/role.errors.js';
import {
  RolePermissionEntity,
} from '../../src/modules/roles/domain/entities/role-permission.entity.js';
import {
  RoleEntity,
} from '../../src/modules/roles/domain/entities/role.entity.js';
import {
  UserRoleEntity,
} from '../../src/modules/roles/domain/entities/user-role.entity.js';
import {
  RolePermissionAlreadyExistsException,
} from '../../src/modules/roles/domain/errors/role-permission.errors.js';

const uuid = '123e4567-e89b-12d3-a456-426614174000';
const now = new Date('2026-01-01T00:00:00.000Z');

describe('roadmap error coverage', () => {
  it('covers analytics error constructors and status contracts', () => {
    expect(new AnalyticsInvalidQueryException().getStatus()).toBe(400);
    expect(new AnalyticsInvalidQueryException('custom').getResponse()).toMatchObject({ code: 'ANALYTICS_INVALID_QUERY', message: 'custom' });
    expect(new AnalyticsScopeException().getStatus()).toBe(403);
    expect(new AnalyticsScopeException('custom').getResponse()).toMatchObject({ code: 'ANALYTICS_FORBIDDEN_SCOPE', message: 'custom' });
    expect(new AnalyticsQueryTimeoutException().getStatus()).toBe(504);
    expect(new AnalyticsUnavailableException().getStatus()).toBe(503);
  });

  it('covers refresh token error constructors and reason guard', () => {
    const errors = [
      new RefreshTokenInvalidError(),
      new RefreshTokenExpiredError(),
      new RefreshTokenRevokedError(),
      new RefreshTokenReuseDetectedError(),
      new RefreshTokenSessionInvalidError(),
    ];
    expect(errors.map((error) => error.code)).toEqual([
      'REFRESH_TOKEN_INVALID',
      'REFRESH_TOKEN_EXPIRED',
      'REFRESH_TOKEN_REVOKED',
      'REFRESH_TOKEN_REUSE_DETECTED',
      'REFRESH_TOKEN_SESSION_INVALID',
    ]);
    expect(isRefreshTokenRevokeReason('LOGOUT')).toBe(true);
    expect(isRefreshTokenRevokeReason('ACCOUNT_LOCKED')).toBe(true);
    expect(isRefreshTokenRevokeReason('INVALID')).toBe(false);
    expect(isRefreshTokenRevokeReason(null)).toBe(false);
  });

  it('covers every permission error path', () => {
    const errors = [
      new PermissionNotFoundException(),
      new PermissionAlreadyExistsException(),
      new PermissionResourceActionAlreadyExistsException(),
      new PermissionInUseException(),
      new SystemPermissionProtectedException(),
      new PermissionUpdateNotAllowedException(),
      new PermissionDeleteNotAllowedException(),
      new UnauthorizedPermissionOperationException(),
      new ForbiddenPermissionOperationException(),
      new InvalidPermissionException('CUSTOM', 'custom'),
    ];
    expect(errors.every((error) => error.code)).toBe(true);
    expect(errors.at(-1)?.code).toBe('CUSTOM');
  });

  it('covers every role error path', () => {
    const errors = [
      new RoleNotFoundException(),
      new RoleAlreadyExistsException(),
      new RoleCodeAlreadyExistsException(),
      new RoleInUseException(),
      new SystemRoleProtectedException(),
      new RoleUpdateNotAllowedException(),
      new RoleDeleteNotAllowedException(),
      new UnauthorizedRoleOperationException(),
      new ForbiddenRoleOperationException(),
      new InvalidRoleException('invalid role'),
    ];
    expect(errors.every((error) => error.code)).toBe(true);
    expect(errors.at(-1)?.message).toBe('invalid role');
  });

  it('covers role and role-permission entity state paths', () => {
    const rolePermission = RolePermissionEntity.create({ roleUuid: uuid, permissionUuid: uuid, createdAt: now, updatedAt: now });
    expect(rolePermission.toSnapshot()).toMatchObject({ roleUuid: uuid, permissionUuid: uuid });

    const role = RoleEntity.create({
      uuid,
      code: 'admin',
      name: 'Admin',
      description: 'Admin role',
      isSystem: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    expect(role.isActive).toBe(true);
    expect(role.toSnapshot()).toMatchObject({ code: 'admin' });
    const inactive = RoleEntity.create({ ...role.toSnapshot(), isActive: false, deletedAt: now });
    expect(inactive.isActive).toBe(false);

    const userRole = UserRoleEntity.create({
      userUuid: uuid,
      roleUuid: uuid,
      roleName: 'Admin',
      roleCode: 'admin',
      roleIsSystem: false,
      isActive: true,
      assignedByUuid: uuid,
      assignedAt: now,
      revokedAt: null,
    });
    expect(userRole.isActive).toBe(true);
    expect(userRole.toSnapshot()).toMatchObject({ roleCode: 'admin' });
  });
});
