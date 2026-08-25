import { Inject, Injectable } from '@nestjs/common';
import type { SecurityAuditRepository } from '../../../../common/audit/security-audit.port.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../../common/audit/security-audit.port.js';
import type { SessionSecurityPort } from '../../../../common/security/session-security.port.js';
import { SESSION_SECURITY_PORT } from '../../../../common/security/session-security.port.js';
import type { UserUpdate } from '../../domain/entities/user.entity.js';
import { UserEntity } from '../../domain/entities/user.entity.js';
import {
  DuplicateUserError,
  InvalidUserError,
  UserNotFoundError,
} from '../../domain/errors/user.errors.js';
import type {
  CreateUserData,
  UserListQuery,
  UserListResult,
  UserRepository,
} from '../../domain/repositories/user.repository.js';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.js';

export interface UserAuditContext {
  actorUuid?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  requestId?: string | undefined;
}

@Injectable()
export class UserManagementService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_SECURITY_PORT)
    private readonly sessions: SessionSecurityPort,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {}

  async create(
    data: CreateUserData,
    context: UserAuditContext = {},
  ): Promise<UserEntity> {
    const normalized: CreateUserData = {
      username: this.normalizeNullable(data.username),
      email: this.normalizeNullable(data.email)?.toLowerCase() ?? null,
      phone: this.normalizeNullable(data.phone),
      status: data.status ?? 'pending',
    };
    if (!normalized.username && !normalized.email && !normalized.phone)
      throw new InvalidUserError('At least one identity is required');
    const duplicate = await this.users.findDuplicateIdentity(normalized);
    if (duplicate) throw new DuplicateUserError();
    const created = await this.users.create(normalized);
    await this.audit.record({
      action: 'USER_CREATED',
      ...(context.actorUuid !== undefined
        ? { actorUuid: context.actorUuid }
        : {}),
      entityType: 'user',
      entityUuid: created.uuid,
      result: 'SUCCESS',
      ...(context.ipAddress !== undefined
        ? { ipAddress: context.ipAddress }
        : {}),
      ...(context.userAgent !== undefined
        ? { userAgent: context.userAgent }
        : {}),
      ...(context.requestId !== undefined
        ? { requestId: context.requestId }
        : {}),
    });
    return created;
  }

  async getByUuid(uuid: string): Promise<UserEntity> {
    const user = await this.users.findByUuid(uuid);
    if (!user) throw new UserNotFoundError();
    return user;
  }
  async getByEmail(email: string): Promise<UserEntity> {
    const user = await this.users.findByEmail(email.toLowerCase());
    if (!user) throw new UserNotFoundError();
    return user;
  }
  async getByUsername(username: string): Promise<UserEntity> {
    const user = await this.users.findByUsername(username);
    if (!user) throw new UserNotFoundError();
    return user;
  }
  async list(query: UserListQuery): Promise<UserListResult> {
    return this.users.list(query);
  }

  async update(
    uuid: string,
    changes: UserUpdate,
    context: UserAuditContext = {},
  ): Promise<UserEntity> {
    const existing = await this.users.findByUuid(uuid);
    if (!existing) throw new UserNotFoundError();
    const normalized: UserUpdate = {
      ...(changes.username !== undefined
        ? { username: this.normalizeNullable(changes.username) }
        : {}),
      ...(changes.email !== undefined
        ? {
            email: this.normalizeNullable(changes.email)?.toLowerCase() ?? null,
          }
        : {}),
      ...(changes.phone !== undefined
        ? { phone: this.normalizeNullable(changes.phone) }
        : {}),
      ...(changes.status !== undefined ? { status: changes.status } : {}),
      ...(changes.isActive !== undefined ? { isActive: changes.isActive } : {}),
    };
    const nextUsername =
      normalized.username !== undefined
        ? normalized.username
        : existing.username;
    const nextEmail =
      normalized.email !== undefined ? normalized.email : existing.email;
    const nextPhone =
      normalized.phone !== undefined ? normalized.phone : existing.phone;
    if (!nextUsername && !nextEmail && !nextPhone)
      throw new InvalidUserError('At least one identity is required');
    const duplicate = await this.users.findDuplicateIdentity(normalized, uuid);
    if (duplicate) throw new DuplicateUserError();
    const updated = await this.users.update(uuid, normalized);
    if (this.hasSecurityDisablingChange(existing, normalized)) {
      await this.sessions.revokeAllForSecurityEvent(
        uuid,
        normalized.isActive === false || normalized.status === 'inactive'
          ? 'ACCOUNT_DISABLED'
          : 'SECURITY_STATE_CHANGE',
        context,
      );
    }
    const auditChanges = [
      ...(existing.username !== updated.username
        ? [
            {
              field: 'username',
              oldValue: existing.username,
              newValue: updated.username,
            },
          ]
        : []),
      ...(existing.email !== updated.email
        ? [
            {
              field: 'email',
              oldValue: existing.email,
              newValue: updated.email,
            },
          ]
        : []),
      ...(existing.phone !== updated.phone
        ? [
            {
              field: 'phone',
              oldValue: existing.phone,
              newValue: updated.phone,
            },
          ]
        : []),
      ...(existing.status !== updated.status
        ? [
            {
              field: 'status',
              oldValue: existing.status,
              newValue: updated.status,
            },
          ]
        : []),
      ...(existing.isActive !== updated.isActive
        ? [
            {
              field: 'isActive',
              oldValue: existing.isActive,
              newValue: updated.isActive,
            },
          ]
        : []),
    ];
    await this.audit.record({
      action: 'USER_UPDATED',
      ...(context.actorUuid !== undefined
        ? { actorUuid: context.actorUuid }
        : {}),
      entityType: 'user',
      entityUuid: updated.uuid,
      result: 'SUCCESS',
      changes: auditChanges,
      ...(context.ipAddress !== undefined
        ? { ipAddress: context.ipAddress }
        : {}),
      ...(context.userAgent !== undefined
        ? { userAgent: context.userAgent }
        : {}),
      ...(context.requestId !== undefined
        ? { requestId: context.requestId }
        : {}),
    });
    return updated;
  }

  async remove(uuid: string, context: UserAuditContext = {}): Promise<void> {
    const existing = await this.users.findByUuid(uuid);
    if (!existing) throw new UserNotFoundError();
    await this.users.softDelete(uuid);
    await this.sessions.revokeAllForSecurityEvent(
      uuid,
      'ACCOUNT_DISABLED',
      context,
    );
    await this.audit.record({
      action: 'USER_DELETED',
      ...(context.actorUuid !== undefined
        ? { actorUuid: context.actorUuid }
        : {}),
      entityType: 'user',
      entityUuid: uuid,
      result: 'SUCCESS',
      reason: 'SOFT_DELETED',
      ...(context.ipAddress !== undefined
        ? { ipAddress: context.ipAddress }
        : {}),
      ...(context.userAgent !== undefined
        ? { userAgent: context.userAgent }
        : {}),
      ...(context.requestId !== undefined
        ? { requestId: context.requestId }
        : {}),
    });
  }

  private hasSecurityDisablingChange(
    existing: UserEntity,
    changes: UserUpdate,
  ): boolean {
    return (
      (changes.isActive === false ||
        changes.status === 'inactive' ||
        changes.status === 'suspended') &&
      existing.isAccessible()
    );
  }

  private normalizeNullable(value: string | null | undefined): string | null {
    if (value === undefined || value === null) return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
}
