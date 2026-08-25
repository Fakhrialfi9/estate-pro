import { SetMetadata } from '@nestjs/common';
import type { AuthorizationMatch } from './authorization.service.js';

export const AUTHORIZATION_PUBLIC_METADATA = 'authorization:public';
export const AUTHORIZATION_PERMISSIONS_METADATA = 'authorization:permissions';
export const AUTHORIZATION_ROLES_METADATA = 'authorization:roles';

export interface AuthorizationRequirement {
  readonly values: readonly string[];
  readonly match: AuthorizationMatch;
}

export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(AUTHORIZATION_PUBLIC_METADATA, true);

export const RequirePermissions = (
  ...permissions: string[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(AUTHORIZATION_PERMISSIONS_METADATA, {
    values: permissions,
    match: 'AND',
  } satisfies AuthorizationRequirement);

export const RequirePermissionsAny = (
  ...permissions: string[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(AUTHORIZATION_PERMISSIONS_METADATA, {
    values: permissions,
    match: 'OR',
  } satisfies AuthorizationRequirement);

export const RequireRoles = (
  ...roles: string[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(AUTHORIZATION_ROLES_METADATA, {
    values: roles,
    match: 'AND',
  } satisfies AuthorizationRequirement);

export const RequireRolesAny = (
  ...roles: string[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(AUTHORIZATION_ROLES_METADATA, {
    values: roles,
    match: 'OR',
  } satisfies AuthorizationRequirement);
