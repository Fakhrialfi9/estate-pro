import { Inject, Injectable } from '@nestjs/common';
import {
  RoleAuthorizationPolicy,
  type RoleActor,
} from '../../../roles/application/policies/role-authorization.policy.js';
import { RoleNotFoundException } from '../../../roles/domain/errors/role.errors.js';
import { PRIVILEGED_ROLE_ASSIGNMENT_PERMISSION } from '../../../roles/application/policies/user-role-authorization.constants.js';
import {
  ROLE_REPOSITORY,
  type RoleRepository,
} from '../../../roles/domain/repositories/role.repository.js';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../domain/repositories/user.repository.js';
import {
  PrivilegedRoleAssignmentForbiddenException,
  UserRoleAlreadyExistsException,
  UserRoleNotFoundException,
  UserTargetNotFoundException,
  InvalidUserRoleIdentifierException,
} from '../../domain/errors/user-role.errors.js';
import {
  USER_ROLE_REPOSITORY,
  type UserRoleListQuery,
  type UserRoleRepository,
} from '../../domain/repositories/user-role.repository.js';
import {
  SECURITY_AUDIT_REPOSITORY,
  type SecurityAuditRepository,
} from '../../../../common/audit/security-audit.port.js';
import type { UserRoleEntity } from '../../domain/entities/user-role.entity.js';

export interface UserRoleMutationAuditContext {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  requestId?: string | undefined;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class UserRoleService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(USER_ROLE_REPOSITORY)
    private readonly userRoles: UserRoleRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
    private readonly policy: RoleAuthorizationPolicy,
  ) {}

  async assign(
    actor: RoleActor,
    userUuid: string,
    roleUuid: string,
    context: UserRoleMutationAuditContext,
  ): Promise<UserRoleEntity> {
    this.policy.canManage(actor);
    this.validateIdentifiers(userUuid, roleUuid);

    const user = await this.users.findByUuid(userUuid);
    if (!user) throw new UserTargetNotFoundException();

    const role = await this.roles.findByUuid(roleUuid);
    if (!role) throw new RoleNotFoundException();

    if (
      role.isSystem &&
      !actor.permissions.includes(PRIVILEGED_ROLE_ASSIGNMENT_PERMISSION)
    ) {
      throw new PrivilegedRoleAssignmentForbiddenException();
    }

    const existing = await this.userRoles.findByUserAndRole(userUuid, roleUuid);
    if (existing?.isActive) throw new UserRoleAlreadyExistsException();

    let assignment: UserRoleEntity;
    try {
      assignment = await this.userRoles.assign({
        userUuid,
        roleUuid,
        assignedByUuid: actor.userUuid,
      });
    } catch (error: unknown) {
      const message = (error as { message?: string }).message;
      if (message === 'UserRoleAlreadyExistsError') {
        throw new UserRoleAlreadyExistsException();
      }
      throw error;
    }

    await this.audit.record({
      action: 'USER_ROLE_ASSIGNED',
      userUuid: actor.userUuid,
      entityType: 'AuthorizationRole',
      entityUuid: role.uuid,
      changes: [
        { field: 'targetUserUuid', oldValue: null, newValue: user.uuid },
        { field: 'roleUuid', oldValue: null, newValue: role.uuid },
      ],
      ...context,
    });

    return assignment;
  }

  async remove(
    actor: RoleActor,
    userUuid: string,
    roleUuid: string,
    context: UserRoleMutationAuditContext,
  ): Promise<void> {
    this.policy.canManage(actor);
    this.validateIdentifiers(userUuid, roleUuid);

    const user = await this.users.findByUuid(userUuid);
    if (!user) throw new UserTargetNotFoundException();

    const role = await this.roles.findByUuid(roleUuid);
    if (!role) throw new RoleNotFoundException();

    this.policy.canManage(actor, role.isSystem);

    const existing = await this.userRoles.findByUserAndRole(userUuid, roleUuid);
    if (!existing?.isActive) throw new UserRoleNotFoundException();

    await this.userRoles.remove({ userUuid, roleUuid });

    await this.audit.record({
      action: 'USER_ROLE_REMOVED',
      userUuid: actor.userUuid,
      entityType: 'AuthorizationRole',
      entityUuid: role.uuid,
      changes: [
        { field: 'targetUserUuid', oldValue: user.uuid, newValue: null },
        { field: 'roleUuid', oldValue: role.uuid, newValue: null },
      ],
      ...context,
    });
  }

  async list(actor: RoleActor, userUuid: string, query: UserRoleListQuery) {
    this.policy.canRead(actor);
    this.validateIdentifiers(userUuid);

    const user = await this.users.findByUuid(userUuid);
    if (!user) throw new UserTargetNotFoundException();

    const result = await this.userRoles.listByUser(userUuid, query);
    return {
      user: { uuid: user.uuid },
      roles: result.items.map((assignment) => ({
        uuid: assignment.roleUuid,
        name: assignment.roleName,
        code: assignment.roleCode,
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    };
  }

  private validateIdentifiers(userUuid: string, roleUuid?: string): void {
    if (
      !UUID_PATTERN.test(userUuid) ||
      (roleUuid !== undefined && !UUID_PATTERN.test(roleUuid))
    ) {
      throw new InvalidUserRoleIdentifierException();
    }
  }
}
