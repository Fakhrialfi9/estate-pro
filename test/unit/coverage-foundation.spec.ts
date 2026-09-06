import { describe, expect, it } from 'vitest';

import { InfrastructureException } from '../../src/common/exceptions/infrastructure.exception.js';
import { PasswordHasherService } from '../../src/common/security/password-hasher.service.js';
import {
  CANONICAL_GRANULARITY,
  METRIC_CATALOG,
} from '../../src/modules/analytics/domain/metrics.js';
import {
  AuditLogChangeEntity,
  AuditLogEntity,
} from '../../src/modules/audit/domain/entities/audit-log.entity.js';
import { RefreshTokenEntity } from '../../src/modules/auth/domain/entities/refresh-token.entity.js';
import { RefreshTokenFamilyEntity } from '../../src/modules/auth/domain/entities/refresh-token-family.entity.js';
import { SessionEntity } from '../../src/modules/auth/domain/entities/session.entity.js';
import { TwoFactorEntity } from '../../src/modules/auth/domain/entities/two-factor.entity.js';
import { PRIVILEGED_ROLE_ASSIGNMENT_PERMISSION } from '../../src/modules/roles/application/policies/user-role-authorization.constants.js';
import { RolePermissionEntity } from '../../src/modules/roles/domain/entities/role-permission.entity.js';
import { UserRoleEntity } from '../../src/modules/roles/domain/entities/user-role.entity.js';
import {
  Facility,
  Property,
  PropertyCategory,
  PropertySubcategory,
} from '../../src/modules/property/domain/entities/property-master.entities.js';

const uuid = '123e4567-e89b-12d3-a456-426614174000';
const now = new Date('2026-01-01T00:00:00.000Z');

describe('coverage foundation', () => {
  it('covers infrastructure exception runtime properties', () => {
    const cause = new Error('root');
    const details = { operation: 'write' };
    const error = new InfrastructureException(
      'DB_UNAVAILABLE',
      'database unavailable',
      details,
      { cause },
    );
    expect(error.name).toBe('InfrastructureException');
    expect(error.code).toBe('DB_UNAVAILABLE');
    expect(error.message).toBe('database unavailable');
    expect(error.details).toEqual(details);
    expect(error.cause).toBe(cause);
    expect(error.category).toBeDefined();
  });

  it('covers metric catalog runtime exports', () => {
    expect(METRIC_CATALOG.leadVolume.formula).toBe('COUNT(leads)');
    expect(METRIC_CATALOG.closedRevenue.source).toContain('sales_deals');
    expect(METRIC_CATALOG.productivity.definition).toContain('explainable');
    expect(CANONICAL_GRANULARITY).toEqual(['day', 'week', 'month']);
  });

  it('covers audit entities', () => {
    const change = new AuditLogChangeEntity({
      field: 'status',
      before: 'draft',
      after: 'active',
    });
    const entity = new AuditLogEntity({
      uuid: 'audit-1',
      actorUuid: uuid,
      actorType: 'USER',
      subjectUuid: uuid,
      action: 'PROPERTY_UPDATED',
      resourceType: 'property',
      resourceId: '1',
      result: 'SUCCESS',
      reason: null,
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      requestId: 'req-1',
      createdAt: now,
      changes: [change.props],
    });
    expect(change.props).toMatchObject({
      field: 'status',
      before: 'draft',
      after: 'active',
    });
    expect(entity.props).toMatchObject({
      uuid: 'audit-1',
      action: 'PROPERTY_UPDATED',
    });
  });

  it('covers refresh token entity states and invalid input', () => {
    const base = {
      id: '1',
      familyId: uuid,
      userUuid: uuid,
      sessionId: '10',
      tokenHash: 'a'.repeat(64),
      issuedAt: now,
      expiresAt: new Date('2026-01-02T00:00:00.000Z'),
      consumedAt: null,
      revokedAt: null,
      revokeReason: null,
    } as const;
    const active = RefreshTokenEntity.create({ ...base });
    expect(active.state(now)).toBe('ACTIVE');
    expect(() => active.assertRefreshable(now)).not.toThrow();
    expect(
      RefreshTokenEntity.create({
        ...base,
        consumedAt: new Date('2026-01-01T01:00:00.000Z'),
      }).state(now),
    ).toBe('CONSUMED');
    expect(
      RefreshTokenEntity.create({
        ...base,
        revokedAt: new Date('2026-01-01T01:00:00.000Z'),
        revokeReason: 'LOGOUT',
      }).state(now),
    ).toBe('REVOKED');
    const expired = RefreshTokenEntity.create({
      ...base,
      expiresAt: new Date('2025-12-31T23:00:00.000Z'),
    });
    expect(expired.state(now)).toBe('EXPIRED');
    expect(() => expired.assertRefreshable(now)).toThrow(
      'Refresh token is expired',
    );
    expect(() =>
      RefreshTokenEntity.create({ ...base, tokenHash: 'bad' }),
    ).toThrow('Invalid refresh token digest');
    expect(() =>
      RefreshTokenEntity.create({ ...base, expiresAt: now }),
    ).toThrow('Refresh token expiry must be after issuance');
  });

  it('covers refresh token family lifecycle', () => {
    const base = {
      id: uuid,
      userUuid: uuid,
      sessionId: '10',
      revokedAt: null,
      revokeReason: null,
      createdAt: now,
      updatedAt: now,
    };
    const active = RefreshTokenFamilyEntity.create(base);
    expect(active.id).toBe(uuid);
    expect(active.userUuid).toBe(uuid);
    expect(active.sessionId).toBe('10');
    expect(active.status()).toBe('active');
    expect(active.isActive()).toBe(true);
    const revoked = RefreshTokenFamilyEntity.create({
      ...base,
      revokedAt: now,
      revokeReason: 'LOGOUT',
    });
    expect(revoked.status()).toBe('revoked');
    expect(revoked.isActive()).toBe(false);
    expect(() =>
      RefreshTokenFamilyEntity.create({ ...base, id: 'bad' }),
    ).toThrow('Invalid refresh token family id');
    expect(() =>
      RefreshTokenFamilyEntity.create({ ...base, sessionId: 'x' }),
    ).toThrow('Invalid refresh token family owner');
  });

  it('covers session active, expired and revoked states', () => {
    const base = {
      id: '42',
      userUuid: uuid,
      sessionIdHash: 'b'.repeat(64),
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      createdAt: now,
      lastActivityAt: null,
      revokedAt: null,
      expiresAt: new Date('2026-01-02T00:00:00.000Z'),
    };
    const session = SessionEntity.create(base);
    expect(session.id).toBe('42');
    expect(session.statusAt(now)).toBe('active');
    expect(session.isActiveAt(now)).toBe(true);
    expect(
      session.statusAt(new Date('2026-01-03T00:00:00.000Z')),
    ).toBe('expired');
    const revoked = SessionEntity.create({
      ...base,
      revokedAt: new Date('2026-01-01T01:00:00.000Z'),
    });
    expect(revoked.statusAt(now)).toBe('revoked');
    expect(revoked.toSnapshot()).toMatchObject({
      id: '42',
      userUuid: uuid,
    });
    expect(revoked.toSafeView(now)).toMatchObject({
      id: '42',
      status: 'revoked',
    });
    expect(() => SessionEntity.create({ ...base, id: 'x' })).toThrow(
      'Invalid session id',
    );
    expect(() =>
      SessionEntity.create({ ...base, sessionIdHash: 'bad' }),
    ).toThrow('Invalid session digest');
    expect(() =>
      SessionEntity.create({ ...base, expiresAt: now }),
    ).toThrow('Session expiry must be after creation');
  });

  it('covers two-factor states', () => {
    const base = {
      id: 1n,
      userUuid: uuid,
      method: 'totp',
      secretEncrypted: 'encrypted',
      enabledAt: null,
      lastUsedAt: null,
      lastUsedTimeStep: null,
      enrollmentStartedAt: now,
      failedVerificationAttempts: 2,
      lockedUntil: new Date('2026-01-01T01:00:00.000Z'),
      createdAt: now,
      updatedAt: now,
    };
    const pending = TwoFactorEntity.create(base);
    expect(pending.status).toBe('PENDING');
    expect(pending.isEnabled()).toBe(false);
    expect(pending.isPending()).toBe(true);
    expect(pending.isLocked(now)).toBe(true);
    expect(pending.lastUsedTimeStep()).toBeNull();
    expect(pending.toPersistence()).toEqual(base);
    const enabled = TwoFactorEntity.create({
      ...base,
      enabledAt: now,
      lastUsedTimeStep: 123n,
      lockedUntil: new Date('2025-12-31T23:00:00.000Z'),
    });
    expect(enabled.status).toBe('ENABLED');
    expect(enabled.isEnabled()).toBe(true);
    expect(enabled.isPending()).toBe(false);
    expect(enabled.isLocked(now)).toBe(false);
    expect(enabled.lastUsedTimeStep()).toBe(123n);
  });

  it('covers role permission and user-role rules', () => {
    const rolePermission = RolePermissionEntity.create({
      roleUuid: uuid,
      permissionUuid: uuid,
      createdAt: now,
      updatedAt: now,
    });
    expect(rolePermission.toSnapshot()).toEqual({
      roleUuid: uuid,
      permissionUuid: uuid,
      createdAt: now,
      updatedAt: now,
    });
    expect(() =>
      RolePermissionEntity.create({
        roleUuid: 'bad',
        permissionUuid: uuid,
        createdAt: now,
        updatedAt: now,
      }),
    ).toThrow('Invalid role UUID');
    const snapshot = {
      userUuid: uuid,
      roleUuid: uuid,
      roleName: 'Admin',
      roleCode: 'admin',
      roleIsSystem: true,
      isActive: true,
      assignedByUuid: null,
      assignedAt: now,
      revokedAt: null,
    };
    const role = UserRoleEntity.create(snapshot);
    expect(role.toSnapshot()).toEqual(snapshot);
    expect(PRIVILEGED_ROLE_ASSIGNMENT_PERMISSION).toBe(
      'roles:manage:protected',
    );
    expect(() => UserRoleEntity.create({ ...snapshot, userUuid: 'bad' })).toThrow(
      'Invalid user UUID',
    );
    expect(() =>
      UserRoleEntity.create({ ...snapshot, roleName: ' ' }),
    ).toThrow('Invalid role identity');
    expect(() =>
      UserRoleEntity.create({ ...snapshot, isActive: false }),
    ).toThrow('Inactive user role must have a revoked timestamp');
    expect(() =>
      UserRoleEntity.create({ ...snapshot, revokedAt: now }),
    ).toThrow('Active user role cannot have a revoked timestamp');
  });

  it('covers property master entities', () => {
    const category = new PropertyCategory(
      'category-1',
      1n,
      ' RESIDENTIAL ',
      'Residential',
      '',
      null,
      null,
      true,
      1,
    );
    expect(category.code).toBe('RESIDENTIAL');
    expect(category.slug).toBe('residential');
    const subcategory = new PropertySubcategory(
      'subcategory-1',
      1n,
      'HOUSE',
      'House',
      '',
      null,
      true,
      1,
    );
    expect(subcategory.slug).toBe('house');
    const facility = new Facility(
      'facility-1',
      'PARKING',
      'Parking',
      '',
      'AMENITY',
      null,
      null,
      1,
      true,
    );
    expect(facility.slug).toBe('parking');
    const property = new Property(
      'property-1',
      1n,
      1n,
      null,
      'P-001',
      'REF-001',
      'Grand Residence',
      '',
      null,
      null,
      'DRAFT',
      'AVAILABLE',
      null,
      null,
      1,
      now,
      now,
      null,
      null,
      'creator',
      null,
      null,
      null,
      null,
    );
    property.updateAvailability(
      'RESERVED',
      now,
      new Date('2026-01-03T00:00:00.000Z'),
    );
    expect(property.availabilityStatus).toBe('RESERVED');
    property.transitionTo('ACTIVE', 'actor-1');
    expect(property.status).toBe('ACTIVE');
    expect(property.updatedBy).toBe('actor-1');
    expect(property.publishedAt).toBeInstanceOf(Date);
    expect(() =>
      new PropertyCategory('x', 1n, '', 'Name', 'slug', null, null, true, 0),
    ).toThrow('Invalid category code');
    expect(() =>
      new PropertySubcategory('x', 1n, 'CODE', '', 'slug', null, true, 0),
    ).toThrow('Invalid subcategory name');
    expect(() =>
      new Facility('x', 'CODE', '', 'slug', 'AMENITY', null, null, 0, true),
    ).toThrow('Invalid facility');
  });

  it('covers the production password hasher implementation', async () => {
    const config = {
      getOrThrow: () => ({
        memoryCost: 8192,
        timeCost: 1,
        parallelism: 1,
        hashLength: 16,
      }),
    } as never;
    const hasher = new PasswordHasherService(config);
    const password = 'unit-test-password';
    const hash = await hasher.hash(password);
    expect(hash).toContain('$argon2id$');
    await expect(hasher.verify(hash, password)).resolves.toBe(true);
    await expect(hasher.verify(hash, 'wrong-password')).resolves.toBe(false);
    await expect(hasher.verify('not-a-hash', password)).resolves.toBe(false);
    expect(hasher.needsRehash(hash)).toBe(false);
  });
});
