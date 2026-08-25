import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  isProtectedRoleCode,
  normalizeRoleCode,
  normalizeRoleName,
  RoleEntity,
} from '../../domain/entities/role.entity.js';
import type { RoleUpdate } from '../../domain/entities/role.entity.js';
import {
  InvalidRoleException,
  RoleAlreadyExistsException,
  RoleCodeAlreadyExistsException,
  RoleDeleteNotAllowedException,
  RoleInUseException,
  RoleNotFoundException,
  RoleUpdateNotAllowedException,
} from '../../domain/errors/role.errors.js';
import {
  ROLE_REPOSITORY,
  type CreateRoleData,
  type RoleListQuery,
  type RoleListResult,
  type RoleRepository,
} from '../../domain/repositories/role.repository.js';
import {
  RoleAuthorizationPolicy,
  ROLE_CREATE_PERMISSION,
  ROLE_DELETE_PERMISSION,
  ROLE_UPDATE_PERMISSION,
  type RoleActor,
} from '../policies/role-authorization.policy.js';
import {
  SECURITY_AUDIT_REPOSITORY,
  type SecurityAuditRepository,
} from '../../../../common/audit/security-audit.port.js';

export interface RoleMutationAuditContext {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  requestId?: string | undefined;
}

@Injectable()
export class RoleService {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
    private readonly policy: RoleAuthorizationPolicy,
  ) {}

  async create(
    actor: RoleActor,
    input: CreateRoleData,
    context: RoleMutationAuditContext,
  ): Promise<RoleEntity> {
    const name = normalizeRoleName(input.name);
    const code = normalizeRoleCode(input.code);
    this.validateInput(name, code);
    this.policy.canManage(
      actor,
      ROLE_CREATE_PERMISSION,
      isProtectedRoleCode(code),
    );
    if (await this.roles.findByName(name))
      throw new RoleAlreadyExistsException();
    if (await this.roles.findByCode(code))
      throw new RoleCodeAlreadyExistsException();

    let role: RoleEntity;
    try {
      role = await this.roles.create({
        name,
        code,
        description: input.description ?? null,
      });
    } catch (error: unknown) {
      this.mapRepositoryError(error);
      throw error;
    }

    await this.audit.record({
      action: 'ROLE_CREATED',
      userUuid: actor.userUuid,
      entityType: 'AuthorizationRole',
      entityUuid: role.uuid,
      ...context,
    });
    return role;
  }

  async get(actor: RoleActor, uuid: string): Promise<RoleEntity> {
    this.policy.canRead(actor);
    const role = await this.roles.findByUuid(uuid);
    if (!role) throw new RoleNotFoundException();
    return role;
  }

  async list(actor: RoleActor, query: RoleListQuery): Promise<RoleListResult> {
    this.policy.canRead(actor);
    return this.roles.list(query);
  }

  async update(
    actor: RoleActor,
    uuid: string,
    changes: RoleUpdate,
    context: RoleMutationAuditContext,
  ): Promise<RoleEntity> {
    const role = await this.roles.findByUuid(uuid);
    if (!role) throw new RoleNotFoundException();
    this.policy.canManage(actor, ROLE_UPDATE_PERMISSION, role.isSystem);

    if (changes.name !== undefined) {
      const name = normalizeRoleName(changes.name);
      this.validateInput(name, role.code);
      const duplicate = await this.roles.findByName(name);
      if (duplicate && duplicate.uuid !== role.uuid)
        throw new RoleAlreadyExistsException();
    }
    if (changes.isActive === false && role.isSystem)
      throw new RoleUpdateNotAllowedException();

    const safeChanges: RoleUpdate = {
      ...(changes.name !== undefined
        ? { name: normalizeRoleName(changes.name) }
        : {}),
      ...(changes.description !== undefined
        ? { description: changes.description }
        : {}),
      ...(changes.isActive !== undefined ? { isActive: changes.isActive } : {}),
    };

    try {
      const updated = await this.roles.update(uuid, safeChanges);
      await this.audit.record({
        action: role.isSystem ? 'SYSTEM_ROLE_UPDATED' : 'ROLE_UPDATED',
        userUuid: actor.userUuid,
        entityType: 'AuthorizationRole',
        entityUuid: updated.uuid,
        changes: this.safeChanges(role, updated),
        ...context,
      });
      return updated;
    } catch (error: unknown) {
      this.mapRepositoryError(error);
      throw error;
    }
  }

  async delete(
    actor: RoleActor,
    uuid: string,
    context: RoleMutationAuditContext,
  ): Promise<void> {
    const role = await this.roles.findByUuid(uuid);
    if (!role) throw new RoleNotFoundException();

    if (role.isSystem) {
      await this.recordSecurityAttempt(
        actor,
        role,
        'SYSTEM_ROLE_DELETE_ATTEMPTED',
        context,
      );
      this.policy.canModifyProtected(actor);
      throw new RoleDeleteNotAllowedException();
    }

    this.policy.canManage(actor, ROLE_DELETE_PERMISSION);
    const dependency = await this.roles.getDependencyCount(uuid);
    if (
      dependency.userAssignments > 0 ||
      dependency.permissionAssignments > 0
    ) {
      await this.recordRoleDeleteBlocked(actor, role, context);
      throw new RoleInUseException();
    }

    try {
      await this.roles.delete(uuid);
    } catch (error: unknown) {
      const code = (error as { code?: string }).code;
      if (code === 'P2003') {
        await this.recordRoleDeleteBlocked(actor, role, context);
        throw new RoleInUseException();
      }
      if (code === 'P2025') throw new RoleNotFoundException();
      throw error;
    }

    await this.audit.record({
      action: 'ROLE_DELETED',
      userUuid: actor.userUuid,
      entityType: 'AuthorizationRole',
      entityUuid: role.uuid,
      ...context,
    });
  }

  private validateInput(name: string, code: string): void {
    try {
      RoleEntity.create({
        uuid: randomUUID(),
        name,
        code,
        description: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        isSystem: isProtectedRoleCode(code),
      });
    } catch (error: unknown) {
      throw new InvalidRoleException(
        error instanceof Error ? error.message : 'Invalid role.',
      );
    }
  }

  private mapRepositoryError(error: unknown): void {
    if (!(error instanceof Error)) return;
    if (error.message === 'RoleCodeAlreadyExistsError')
      throw new RoleCodeAlreadyExistsException();
    if (error.message === 'RoleAlreadyExistsError')
      throw new RoleAlreadyExistsException();
  }

  private safeChanges(before: RoleEntity, after: RoleEntity) {
    return [
      ...(before.name !== after.name
        ? [{ field: 'name', oldValue: before.name, newValue: after.name }]
        : []),
      ...(before.description !== after.description
        ? [
            {
              field: 'description',
              oldValue: before.description,
              newValue: after.description,
            },
          ]
        : []),
      ...(before.isActive !== after.isActive
        ? [
            {
              field: 'isActive',
              oldValue: before.isActive,
              newValue: after.isActive,
            },
          ]
        : []),
    ];
  }

  private async recordRoleDeleteBlocked(
    actor: RoleActor,
    role: RoleEntity,
    context: RoleMutationAuditContext,
  ): Promise<void> {
    await this.audit.record({
      action: 'ROLE_DELETE_BLOCKED',
      userUuid: actor.userUuid,
      entityType: 'AuthorizationRole',
      entityUuid: role.uuid,
      changes: [{ field: 'reason', oldValue: null, newValue: 'ROLE_IN_USE' }],
      ...context,
    });
  }

  private async recordSecurityAttempt(
    actor: RoleActor,
    role: RoleEntity,
    action: string,
    context: RoleMutationAuditContext,
  ): Promise<void> {
    await this.audit.record({
      action,
      userUuid: actor.userUuid,
      entityType: 'AuthorizationRole',
      entityUuid: role.uuid,
      ...context,
    });
  }
}
