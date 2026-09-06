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
import {
  RefreshTokenEntity,
  type RefreshTokenSnapshot,
} from '../../src/modules/auth/domain/entities/refresh-token.entity.js';
import { RefreshTokenFamilyEntity } from '../../src/modules/auth/domain/entities/refresh-token-family.entity.js';
import { SessionEntity } from '../../src/modules/auth/domain/entities/session.entity.js';
import { TwoFactorEntity } from '../../src/modules/auth/domain/entities/two-factor.entity.js';
import { RolePermissionEntity } from '../../src/modules/roles/domain/entities/role-permission.entity.js';
import { PRIVILEGED_ROLE_ASSIGNMENT_PERMISSION } from '../../src/modules/roles/application/policies/user-role-authorization.constants.js';
import {
  UserRoleEntity,
  type UserRoleSnapshot,
} from '../../src/modules/roles/domain/entities/user-role.entity.js';
import {
  Facility,
  Property,
  PropertyCategory,
  PropertySubcategory,
} from '../../src/modules/property/domain/entities/property-master.entities.js';

describe('coverage foundation: runtime domain contracts', () => {
  it('constructs InfrastructureException with runtime metadata and cause', () => {
    const cause = new Error('root');
    const details = { operation: 'write' };
    const error = new InfrastructureException(
      'DB_UNAVAILABLE',
      'database unavailable',
      details,
      { cause },
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('InfrastructureException');
    expect(error.code).toBe('DB_UNAVAILABLE');
    expect(error.message).toBe('database unavailable');
    expect(error.category).toBeDefined();
    expect(error.details).toEqual(details);
    expect(error.cause).toBe(cause);
  });

  it('exposes the analytics metric catalog and canonical granularities', () => {
    expect(METRIC_CATALOG.leadVolume.source).toBe('crm_leads');
    expect(METRIC_CATALOG.conversionRate.formula).toContain('eligible');
    expect(METRIC_CATALOG.productivity.definition).toContain('explainable');
    expect(CANONICAL_GRANULARITY).toEqual(['day', 'week', 'month']);
  });

  it('constructs audit entities without losing their readonly props', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const change = new AuditLogChangeEntity({
      field: 'status',
      before: 'draft',
      after: 'active',
    });
    const entity = new AuditLogEntity({
      uuid: 'audit-1',
      actorUuid: 'user-1',
      actorType: 'USER',
      subjectUuid: 'user-2',
      action: 'PROPERTY_UPDATED',
      resourceType: 'property',
      resourceId: 'property-1',
      result: 'SUCCESS',
      reason: null,
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      requestId: 'req-1',
      createdAt,
      changes: [change.props],
    });

    expect(change.props.field).toBe('status');
    expect(entity.props.uuid).toBe('audit-1');
    expect(entity.props.createdAt).toBe(createdAt);
    expect(entity.props.changes).toHaveLength(1);
  });

  it('covers refresh-token entity validation and all states', () => {
    const issuedAt = new Date('2026-01-01T00:00:00.000Z');
    const expiresAt = new Date('2026-01-02T00:00:00.000Z');
    const digest = 'a'.repeat(64);
    const base: RefreshTokenSnapshot = {
      id: '1',
      familyId: 'family-1',
      userUuid: 'user-1',
      sessionId: '10',
      tokenHash: digest,
      issuedAt,
      expiresAt,
      consumedAt: null,
      revokedAt: null,
      revokeReason: null,
    };

    const active = RefreshTokenEntity.create(base);
    expect(active.id).toBe('1');
    expect(active.familyId).toBe('family-1');
    expect(active.userUuid).toBe('user-1');
    expect(active.sessionId).toBe('10');
    expect(active.expiresAt).toBe(expiresAt);
    expect(active.consumedAt).toBeNull();
    expect(active.revokedAt).toBeNull();
    expect(active.revokeReason).toBeNull();
    expect(active.state(issuedAt)).toBe('ACTIVE');
    expect(() => active.assertRefreshable(issuedAt)).not.toThrow();

    expect(
      RefreshTokenEntity.create({
        ...base,
        consumedAt: new Date('2026-01-01T01:00:00.000Z'),
      }).state(issuedAt),
    ).toBe('CONSUMED');
    expect(
      RefreshTokenEntity.create({
        ...base,
        revokedAt: new Date('2026-01-01T01:00:00.000Z'),
        revokeReason: 'LOGOUT',
      }).state(issuedAt),
    ).toBe('REVOKED');

    const expired = RefreshTokenEntity.create({
      ...base,
      expiresAt: new Date('2026-01-01T00:30:00.000Z'),
    });
    expect(expired.state(new Date('2026-01-01T01:00:00.000Z'))).toBe('EXPIRED');
    expect(() => expired.assertRefreshable(new Date('2026-01-01T01:00:00.000Z'))).toThrow(
      'Refresh token is expired',
    );

    expect(() => RefreshTokenEntity.create({ ...base, tokenHash: 'bad' })).toThrow(
      'Invalid refresh token digest',
    );
    expect(() => RefreshTokenEntity.create({ ...base, expiresAt: issuedAt })).toThrow(
      'Refresh token expiry must be after issuance',
    );
  });

  it('covers refresh-token family status and validation', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const id = '123e4567-e89b-12d3-a456-426614174000';
    const active = RefreshTokenFamilyEntity.create({
      id,
      userUuid: 'user-1',
      sessionId: '7',
      revokedAt: null,
      revokeReason: null,
      createdAt: now,
      updatedAt: now,
    });

    expect(active.id).toBe(id);
    expect(active.userUuid).toBe('user-1');
    expect(active.sessionId).toBe('7');
    expect(active.revokedAt).toBeNull();
    expect(active.revokeReason).toBeNull();
    expect(active.status()).toBe('active');
    expect(active.isActive()).toBe(true);

    const revoked = RefreshTokenFamilyEntity.create({
      id,
      userUuid: 'user-1',
      sessionId: '7',
      revokedAt: now,
      revokeReason: 'LOGOUT',
      createdAt: now,
      updatedAt: now,
    });
    expect(revoked.status()).toBe('revoked');
    expect(revoked.isActive()).toBe(false);
    expect(() => RefreshTokenFamilyEntity.create({ ...active['snapshot'] as never, id: 'bad' })).toThrow(
      'Invalid refresh token family id',
    );
  });

  it('covers session lifecycle, safe views and validation', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const expiresAt = new Date('2026-01-02T00:00:00.000Z');
    const snapshot = {
      id: '42',
      userUuid: 'user-1',
      sessionIdHash: 'b'.repeat(64),
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      createdAt,
      lastActivityAt: null,
      revokedAt: null,
      expiresAt,
    };
    const entity = SessionEntity.create(snapshot);

    expect(entity.id).toBe('42');
    expect(entity.userUuid).toBe('user-1');
    expect(entity.ipAddress).toBe('127.0.0.1');
    expect(entity.userAgent).toBe('vitest');
    expect(entity.createdAt).toBe(createdAt);
    expect(entity.lastActivityAt).toBeNull();
    expect(entity.revokedAt).toBeNull();
    expect(entity.expiresAt).toBe(expiresAt);
    expect(entity.statusAt(createdAt)).toBe('active');
    expect(entity.isActiveAt(createdAt)).toBe(true);
    expect(entity.statusAt(new Date('2026-01-03T00:00:00.000Z'))).toBe('expired');
    expect(entity.isActiveAt(new Date('2026-01-03T00:00:00.000Z'))).toBe(false);
    const revoked = SessionEntity.create({
      ...snapshot,
      revokedAt: new Date('2026-01-01T01:00:00.000Z'),
    });
    expect(revoked.statusAt(createdAt)).toBe('revoked');
    expect(revoked.toSnapshot()).toMatchObject({ id: '42', userUuid: 'user-1' });
    expect(revoked.toSafeView(createdAt)).toMatchObject({ id: '42', status: 'revoked' });

    expect(() => SessionEntity.create({ ...snapshot, id: 'x' })).toThrow('Invalid session id');
    expect(() => SessionEntity.create({ ...snapshot, sessionIdHash: 'bad' })).toThrow(
      'Invalid session digest',
    );
    expect(() => SessionEntity.create({ ...snapshot, expiresAt: createdAt })).toThrow(
      'Session expiry must be after creation',
    );
  });

  it('covers two-factor entity state helpers', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const base = {
      id: 1n,
      userUuid: 'user-1',
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
    expect(pending.id).toBe(1n);
    expect(pending.userUuid).toBe('user-1');
    expect(pending.encryptedSecret).toBe('encrypted');
    expect(pending.status).toBe('PENDING');
    expect(pending.failedVerificationAttempts).toBe(2);
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

  it('covers role permission and user role entity rules', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    const rolePermission = RolePermissionEntity.create({
      roleUuid: uuid,
      permissionUuid: uuid,
      createdAt: now,
      updatedAt: now,
    });
    expect(rolePermission.roleUuid).toBe(uuid);
    expect(rolePermission.permissionUuid).toBe(uuid);
    expect(rolePermission.createdAt).toBe(now);
    expect(rolePermission.updatedAt).toBe(now);
    expect(rolePermission.toSnapshot()).toEqual({
      roleUuid: uuid,
      permissionUuid: uuid,
      createdAt: now,
      updatedAt: now,
    });
    expect(() => RolePermissionEntity.create({ roleUuid: 'bad', permissionUuid: uuid, createdAt: now, updatedAt: now })).toThrow(
      'Invalid role UUID',
    );

    const userRoleSnapshot: UserRoleSnapshot = {
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
    const userRole = UserRoleEntity.create(userRoleSnapshot);
    expect(userRole.userUuid).toBe(uuid);
    expect(userRole.roleUuid).toBe(uuid);
    expect(userRole.roleName).toBe('Admin');
    expect(userRole.roleCode).toBe('admin');
    expect(userRole.roleIsSystem).toBe(true);
    expect(userRole.isActive).toBe(true);
    expect(userRole.assignedByUuid).toBeNull();
    expect(userRole.assignedAt).toBe(now);
    expect(userRole.revokedAt).toBeNull();
    expect(userRole.toSnapshot()).toEqual(userRoleSnapshot);

    expect(PRIVILEGED_ROLE_ASSIGNMENT_PERMISSION).toBe('roles:manage:protected');
    expect(() => UserRoleEntity.create({ ...userRoleSnapshot, userUuid: 'bad' })).toThrow(
      'Invalid user UUID',
    );
    expect(() => UserRoleEntity.create({ ...userRoleSnapshot, roleName: ' ' })).toThrow(
      'Invalid role identity',
    );
    expect(() => UserRoleEntity.create({ ...userRoleSnapshot, isActive: false })).toThrow(
      'Inactive user role must have a revoked timestamp',
    );
    expect(() => UserRoleEntity.create({ ...userRoleSnapshot, revokedAt: now })).toThrow(
      'Active user role cannot have a revoked timestamp',
    );
  });

  it('covers property master entity normalization and lifecycle', () => {
    const category = new PropertyCategory(
      'category-1',
      1n,
      '  RESIDENTIAL ',
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
    expect(facility.code).toBe('PARKING');
    expect(facility.slug).toBe('parking');

    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const property = new Property(
      'property-1',
      1n,
      1n,
      null,
      ' P-001 ',
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
      createdAt,
      createdAt,
      null,
      null,
      'creator',
      null,
      null,
      null,
      null,
    );
    expect(property.slug).toBe('grand-residence');
    property.updateAvailability('RESERVED', createdAt, new Date('2026-01-03T00:00:00.000Z'));
    expect(property.availabilityStatus).toBe('RESERVED');
    expect(property.availableFrom).toBe(createdAt);
    expect(property.availableTo).toBeInstanceOf(Date);
    property.transitionTo('ACTIVE', 'actor-1');
    expect(property.status).toBe('ACTIVE');
    expect(property.updatedBy).toBe('actor-1');
    expect(property.publishedAt).toBeInstanceOf(Date);

    expect(() => new PropertyCategory('x', 1n, '', 'Name', 'slug', null, null, true, 0)).toThrow(
      'Invalid category code',
    );
    expect(() => new PropertySubcategory('x', 1n, 'CODE', '', 'slug', null, true, 0)).toThrow(
      'Invalid subcategory name',
    );
    expect(() => new Facility('x', 'CODE', '', 'slug', 'AMENITY', null, null, 0, true)).toThrow(
      'Invalid facility',
    );
    expect(() => new Property('x', 1n, 1n, null, 'CODE', 'REF', '', 'slug', null, null, 'DRAFT', 'AVAILABLE', null, null, 1, createdAt, createdAt, null, null, null, null, null, null, null, null)).toThrow(
      'title is required',
    );
  });

  it('covers password hashing through the production hasher implementation', async () => {
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
