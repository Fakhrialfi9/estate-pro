import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  buildPermissionCode,
  normalizePermissionName,
  normalizePermissionSegment,
  PermissionEntity,
} from '../../domain/entities/permission.entity.js';
import type { PermissionUpdate } from '../../domain/entities/permission.entity.js';
import {
  InvalidPermissionException,
  PermissionAlreadyExistsException,
  PermissionInUseException,
  PermissionNotFoundException,
  PermissionResourceActionAlreadyExistsException,
  SystemPermissionProtectedException,
} from '../../domain/errors/permission.errors.js';
import {
  PERMISSION_REPOSITORY,
  type CreatePermissionData,
  type PermissionListQuery,
  type PermissionListResult,
  type PermissionRepository,
} from '../../domain/repositories/permission.repository.js';
import {
  PermissionAuthorizationPolicy,
  type PermissionActor,
} from '../policies/permission-authorization.policy.js';
import {
  SECURITY_AUDIT_REPOSITORY,
  type SecurityAuditRepository,
} from '../../../../common/audit/security-audit.port.js';

export interface PermissionMutationAuditContext {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  requestId?: string | undefined;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class PermissionService {
  constructor(
    @Inject(PERMISSION_REPOSITORY)
    private readonly permissions: PermissionRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
    private readonly policy: PermissionAuthorizationPolicy,
  ) {}

  async create(
    actor: PermissionActor,
    input: CreatePermissionData,
    context: PermissionMutationAuditContext,
  ): Promise<PermissionEntity> {
    const name = normalizePermissionName(input.name);
    const module = normalizePermissionSegment(input.module);
    const domain = normalizePermissionSegment(input.domain);
    const action = normalizePermissionSegment(input.action);
    this.validateInput(name, module, domain, action);

    const code = buildPermissionCode(module, domain, action);
    this.policy.canManage(actor, code);

    if (await this.permissions.findByResourceAction(module, domain, action)) {
      throw new PermissionResourceActionAlreadyExistsException();
    }
    if (await this.permissions.findByCode(code)) {
      throw new PermissionAlreadyExistsException();
    }

    let permission: PermissionEntity;
    try {
      permission = await this.permissions.create({
        name,
        module,
        domain,
        action,
      });
    } catch (error: unknown) {
      this.mapRepositoryError(error);
      throw error;
    }

    await this.audit.record({
      action: 'PERMISSION_CREATED',
      userUuid: actor.userUuid,
      entityType: 'AuthorizationPermission',
      entityUuid: permission.uuid,
      ...context,
    });
    return permission;
  }

  async get(actor: PermissionActor, uuid: string): Promise<PermissionEntity> {
    this.policy.canRead(actor);
    this.validateUuid(uuid);
    const permission = await this.permissions.findByUuid(uuid);
    if (!permission) throw new PermissionNotFoundException();
    return permission;
  }

  async list(
    actor: PermissionActor,
    query: PermissionListQuery,
  ): Promise<PermissionListResult> {
    this.policy.canRead(actor);
    return this.permissions.list(query);
  }

  async update(
    actor: PermissionActor,
    uuid: string,
    changes: PermissionUpdate,
    context: PermissionMutationAuditContext,
  ): Promise<PermissionEntity> {
    this.validateUuid(uuid);
    const permission = await this.permissions.findByUuid(uuid);
    if (!permission) throw new PermissionNotFoundException();

    try {
      this.policy.canManage(actor, permission.code);
    } catch (error: unknown) {
      if (error instanceof SystemPermissionProtectedException) {
        await this.recordSecurityAttempt(
          actor,
          permission,
          'SYSTEM_PERMISSION_UPDATE_ATTEMPTED',
          context,
        );
      }
      throw error;
    }

    const safeChanges: PermissionUpdate =
      changes.name !== undefined
        ? { name: normalizePermissionName(changes.name) }
        : {};
    this.validateInput(
      safeChanges.name ?? permission.name,
      permission.module,
      permission.domain,
      permission.action,
    );

    try {
      const updated = await this.permissions.update(uuid, safeChanges);
      await this.audit.record({
        action: 'PERMISSION_UPDATED',
        userUuid: actor.userUuid,
        entityType: 'AuthorizationPermission',
        entityUuid: updated.uuid,
        changes: this.safeChanges(permission, updated),
        ...context,
      });
      return updated;
    } catch (error: unknown) {
      this.mapRepositoryError(error);
      throw error;
    }
  }

  async delete(
    actor: PermissionActor,
    uuid: string,
    context: PermissionMutationAuditContext,
  ): Promise<void> {
    this.validateUuid(uuid);
    const permission = await this.permissions.findByUuid(uuid);
    if (!permission) throw new PermissionNotFoundException();

    try {
      this.policy.canManage(actor, permission.code);
    } catch (error: unknown) {
      if (error instanceof SystemPermissionProtectedException) {
        await this.recordSecurityAttempt(
          actor,
          permission,
          'SYSTEM_PERMISSION_DELETE_ATTEMPTED',
          context,
        );
      }
      throw error;
    }

    const dependency = await this.permissions.getDependencyCount(uuid);
    if (dependency.roleAssignments > 0) {
      await this.recordPermissionDeleteBlocked(actor, permission, context);
      throw new PermissionInUseException();
    }

    try {
      await this.permissions.delete(uuid);
    } catch (error: unknown) {
      const code = (error as { code?: string }).code;
      if (code === 'P2003') {
        await this.recordPermissionDeleteBlocked(actor, permission, context);
        throw new PermissionInUseException();
      }
      if (code === 'P2025') throw new PermissionNotFoundException();
      throw error;
    }

    await this.audit.record({
      action: 'PERMISSION_DELETED',
      userUuid: actor.userUuid,
      entityType: 'AuthorizationPermission',
      entityUuid: permission.uuid,
      ...context,
    });
  }

  private validateInput(
    name: string,
    module: string,
    domain: string,
    action: string,
  ): void {
    try {
      PermissionEntity.create({
        uuid: randomUUID(),
        name,
        code: buildPermissionCode(module, domain, action),
        module,
        domain,
        action,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Invalid permission.';
      const code = message.includes('name')
        ? 'INVALID_PERMISSION_NAME'
        : message.includes('module') || message.includes('domain')
          ? 'INVALID_RESOURCE'
          : message.includes('action')
            ? 'INVALID_ACTION'
            : 'INVALID_PERMISSION_NAME';
      throw new InvalidPermissionException(code, message);
    }
  }

  private validateUuid(uuid: string): void {
    if (!UUID_PATTERN.test(uuid)) {
      throw new InvalidPermissionException(
        'INVALID_PERMISSION_IDENTIFIER',
        'Permission identifier is invalid.',
      );
    }
  }

  private mapRepositoryError(error: unknown): void {
    const repositoryError = error as { message?: string };
    if (repositoryError.message === 'PermissionAlreadyExistsError') {
      throw new PermissionAlreadyExistsException();
    }
    if (repositoryError.message === 'PermissionResourceActionAlreadyExistsError') {
      throw new PermissionResourceActionAlreadyExistsException();
    }
    if (repositoryError.message === 'PermissionNotFoundError') {
      throw new PermissionNotFoundException();
    }
  }

  private safeChanges(
    before: PermissionEntity,
    after: PermissionEntity,
  ): Array<{
    field: string;
    oldValue: string | boolean | number | null;
    newValue: string | boolean | number | null;
  }> {
    return before.name === after.name
      ? []
      : [{ field: 'name', oldValue: before.name, newValue: after.name }];
  }

  private async recordPermissionDeleteBlocked(
    actor: PermissionActor,
    permission: PermissionEntity,
    context: PermissionMutationAuditContext,
  ): Promise<void> {
    await this.audit.record({
      action: 'PERMISSION_DELETE_BLOCKED',
      userUuid: actor.userUuid,
      entityType: 'AuthorizationPermission',
      entityUuid: permission.uuid,
      changes: [{ field: 'reason', oldValue: null, newValue: 'PERMISSION_IN_USE' }],
      ...context,
    });
  }

  private async recordSecurityAttempt(
    actor: PermissionActor,
    permission: PermissionEntity,
    action: string,
    context: PermissionMutationAuditContext,
  ): Promise<void> {
    await this.audit.record({
      action,
      userUuid: actor.userUuid,
      entityType: 'AuthorizationPermission',
      entityUuid: permission.uuid,
      ...context,
    });
  }
}
