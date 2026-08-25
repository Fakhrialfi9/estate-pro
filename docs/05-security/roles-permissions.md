# Roles and Permissions

Authorization is represented by three persistent relationships:

1. `AuthorizationRole` defines a named role and active state.
2. `AuthorizationPermission` defines a permission code and its module/domain/action metadata.
3. `AuthorizationRolePermission` maps roles to permissions, while `AuthorizationUserRole` maps users to roles.

Controllers declare required permissions through authorization decorators. `AuthorizationGuard` resolves the effective role/permission snapshot from `AuthorizationService` for every protected request. JWT claims identify the authenticated subject and session; they are not the source of truth for RBAC state.

Role and permission mutation endpoints require their dedicated management permissions and are audited by their application services. Removing an active assignment changes the result of the next authorization resolution.
