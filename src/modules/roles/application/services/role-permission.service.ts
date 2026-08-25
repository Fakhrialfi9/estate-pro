import { Inject, Injectable } from '@nestjs/common';
import type { PermissionRepository } from '../../../permissions/permissions.module.js';
import {
  PERMISSION_REPOSITORY,
  PermissionAuthorizationPolicy,
  PermissionNotFoundException,
} from '../../../permissions/permissions.module.js';
import {
  ROLE_REPOSITORY,
  type RoleRepository,
} from '../../domain/repositories/role.repository.js';
import {
  ROLE_PERMISSION_REPOSITORY,
  type RolePermissionListQuery,
  type RolePermissionRepository,
} from '../../domain/repositories/role-permission.repository.js';
import {
  ForbiddenRoleOperationException,
  RoleNotFoundException,
} from '../../domain/errors/role.errors.js';
import {
  RolePermissionAlreadyExistsException,
  RolePermissionAssignmentForbiddenException,
  RolePermissionNotFoundException,
  RolePermissionRemovalForbiddenException,
  InvalidRolePermissionIdentifierException,
} from '../../domain/errors/role-permission.errors.js';
import {
  RoleAuthorizationPolicy,
  type RoleActor,
} from '../policies/role-authorization.policy.js';
import {
  SECURITY_AUDIT_REPOSITORY,
  type SecurityAuditRepository,
} from '../../../../common/audit/security-audit.port.js';
import type { RoleEntity } from '../../domain/entities/role.entity.js';

export interface RolePermissionMutationAuditContext {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  requestId?: string | undefined;
}

export interface RolePermissionPermissionView {
  uuid: string;
  name: string;
  code: string;
  module: string;
  domain: string;
  action: string;
}

export interface RolePermissionAssignmentView {
  role: RoleEntity;
  permission: RolePermissionPermissionView;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class RolePermissionService {
  constructor(
    @Inject(ROLE_PERMISSION_REPOSITORY)
    private readonly assignments: RolePermissionRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roles: RoleRepository,
    @Inject(PERMISSION_REPOSITORY)
    private readonly permissions: PermissionRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
    private readonly rolePolicy: RoleAuthorizationPolicy,
    private readonly permissionPolicy: PermissionAuthorizationPolicy,
  ) {}

  async assign(
    actor: RoleActor,
    roleUuid: string,
    permissionUuid: string,
    context: RolePermissionMutationAuditContext,
  ): Promise<RolePermissionAssignmentView> {
    this.requireRoleManage(actor, 'assign');
    this.validateRoleUuid(roleUuid);
    this.validatePermissionUuid(permissionUuid);

    const role = await this.roles.findByUuid(roleUuid);
    if (!role) throw new RoleNotFoundException();

    const permission = await this.permissions.findByUuid(permissionUuid);
    if (!permission) throw new PermissionNotFoundException();

    this.enforceProtectedPolicy(actor, role, permission);

    if (await this.assignments.exists(roleUuid, permissionUuid)) {
      throw new RolePermissionAlreadyExistsException();
    }

    try {
      await this.assignments.assign(roleUuid, permissionUuid);
    } catch (error: unknown) {
      this.mapRepositoryError(error);
      throw error;
    }

    await this.audit.record({
      action: 'ROLE_PERMISSION_ASSIGNED',
      userUuid: actor.userUuid,
      entityType: 'AuthorizationRole',
      entityUuid: role.uuid,
      changes: [
        {
          field: 'permission',
          oldValue: null,
          newValue: permission.code,
        },
      ],
      ...context,
    });

    return {
      role,
      permission: {
        uuid: permission.uuid,
        name: permission.name,
        code: permission.code,
        module: permission.module,
        domain: permission.domain,
        action: permission.action,
      },
    };
  }

  async remove(
    actor: RoleActor,
    roleUuid: string,
    permissionUuid: string,
    context: RolePermissionMutationAuditContext,
  ): Promise<void> {
    this.requireRoleManage(actor, 'remove');
    this.validateRoleUuid(roleUuid);
    this.validatePermissionUuid(permissionUuid);

    const role = await this.roles.findByUuid(roleUuid);
    if (!role) throw new RoleNotFoundException();

    const permission = await this.permissions.findByUuid(permissionUuid);
    if (!permission) throw new PermissionNotFoundException();

    this.enforceProtectedPolicy(actor, role, permission);

    if (!(await this.assignments.exists(roleUuid, permissionUuid))) {
      throw new RolePermissionNotFoundException();
    }

    try {
      await this.assignments.remove(roleUuid, permissionUuid);
    } catch (error: unknown) {
      this.mapRepositoryError(error);
      throw error;
    }

    await this.audit.record({
      action: 'ROLE_PERMISSION_REMOVED',
      userUuid: actor.userUuid,
      entityType: 'AuthorizationRole',
      entityUuid: role.uuid,
      changes: [
        {
          field: 'permission',
          oldValue: permission.code,
          newValue: null,
        },
      ],
      ...context,
    });
  }

  async list(
    actor: RoleActor,
    roleUuid: string,
    query: RolePermissionListQuery,
  ) {
    this.rolePolicy.canRead(actor);
    this.validateRoleUuid(roleUuid);
    const role = await this.roles.findByUuid(roleUuid);
    if (!role) throw new RoleNotFoundException();
    return {
      role,
      assignments: await this.assignments.listByRole(roleUuid, query),
    };
  }

  private requireRoleManage(
    actor: RoleActor,
    operation: 'assign' | 'remove',
  ): void {
    try {
      this.rolePolicy.canManage(actor);
    } catch (error: unknown) {
      if (error instanceof ForbiddenRoleOperationException) {
        throw operation === 'assign'
          ? new RolePermissionAssignmentForbiddenException()
          : new RolePermissionRemovalForbiddenException();
      }
      throw error;
    }
  }

  private enforceProtectedPolicy(
    actor: RoleActor,
    role: RoleEntity,
    permission: ReturnType<PermissionRepository['findByUuid']> extends Promise<
      infer T
    >
      ? Exclude<T, null>
      : never,
  ): void {
    this.rolePolicy.canManage(actor, role.isSystem);
    if (permission.isSystem) {
      this.permissionPolicy.canManageProtected(actor);
    }
  }

  private validateRoleUuid(uuid: string): void {
    if (!UUID_PATTERN.test(uuid)) {
      throw new InvalidRolePermissionIdentifierException('role');
    }
  }

  private validatePermissionUuid(uuid: string): void {
    if (!UUID_PATTERN.test(uuid)) {
      throw new InvalidRolePermissionIdentifierException('permission');
    }
  }

  private mapRepositoryError(error: unknown): void {
    const message = error instanceof Error ? error.message : '';
    if (message === 'RolePermissionAlreadyExistsError') {
      throw new RolePermissionAlreadyExistsException();
    }
    if (message === 'RolePermissionNotFoundError') {
      throw new RolePermissionNotFoundException();
    }
    if (message === 'RolePermissionConflictError') {
      throw new RolePermissionAlreadyExistsException();
    }
    if (message === 'RoleNotFoundError') {
      throw new RoleNotFoundException();
    }
    if (message === 'PermissionNotFoundError') {
      throw new PermissionNotFoundException();
    }
  }
}
