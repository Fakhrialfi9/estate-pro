import { Inject, Injectable } from '@nestjs/common';
import type { PermissionRepository } from '../../../permissions/domain/repositories/permission.repository.js';
import { PERMISSION_REPOSITORY } from '../../../permissions/domain/repositories/permission.repository.js';
import { PermissionAuthorizationPolicy } from '../../../permissions/application/policies/permission-authorization.policy.js';
import { PermissionNotFoundException } from '../../../permissions/domain/errors/permission.errors.js';
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
