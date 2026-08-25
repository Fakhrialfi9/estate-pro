# Persistence Ownership

Steps 1–10 establish one owner per security/identity persistence boundary.

| Table | Owner module | Responsibility |
|---|---|---|
| `authentication_users` | `auth` | Authentication identity |
| `authentication_user_credentials` | `auth` | Password credential material |
| `authentication_user_profiles` | `users` | User profile/presentation data |
| `authentication_user_security` | `security` | Authentication security state |
| `authentication_user_sessions` | `security` | Session lifecycle |
| `authentication_user_two_factors` | `security` | 2FA lifecycle/configuration |
| `authorization_roles` | `roles` | Role definitions |
| `authorization_permissions` | `permissions` | Permission definitions |
| `authorization_user_roles` | `roles` | User-to-role assignment |
| `authorization_role_permissions` | `roles` | Role-to-permission assignment |
| `audit_logs` | `audit` | Audit events |
| `audit_log_changes` | `audit` | Audit change details |

## Ownership rules

- A module may own and mutate only its own persistence boundary.
- A foreign key to `authentication_users` is an identity reference, not shared table ownership.
- Authorization tables do not own authentication identity.
- Profile tables do not own credentials or security state.
- Audit tables are append-oriented cross-cutting records and are not part of the user aggregate.
- Prisma access remains behind `src/infrastructure/database`; domain and application code consume contracts.
- No module may bypass another module's public boundary to access its repository, domain object, or persistence adapter.

The physical database may contain all tables in one database, but physical co-location does not change logical ownership.
