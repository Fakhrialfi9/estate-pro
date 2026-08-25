# Security and Identity Boundaries

## Scope

This document defines the ownership and dependency boundaries established by Steps 1–10. It describes the implementation contract; it is not a substitute for the Prisma schema or module structure.

## Authentication

`auth` owns authentication behavior and credential verification. The authentication identity source of truth is the `authentication_users` table. Authentication identifies the actor and establishes authenticated state; it does not own profile presentation data or authorization decisions.

Credential persistence is isolated in `authentication_user_credentials`. Password hashes are never part of the identity or profile model.

## User Management / Profile

`users` owns user-management and profile data. `authentication_user_profiles` contains presentation/personalization data only. A profile references the authentication identity but cannot establish authentication state and contains no credential or security secret.

## Security

Security state is an independent concern. `authentication_user_security`, `authentication_user_sessions`, and `authentication_user_two_factors` are security resources related to the authentication identity.

- Security state owns login-security state such as lockout and failed attempts.
- Session owns session lifecycle: creation, validation, expiry, revocation, and termination.
- 2FA owns its own configuration and verification lifecycle.
- None of these resources is a profile or password credential.

## Authorization

`roles` and `permissions` own access control. `authorization_roles`, `authorization_permissions`, `authorization_user_roles`, and `authorization_role_permissions` describe authorization relationships only.

Authentication proves identity; authorization decides whether an already identified actor may perform an operation. Role/permission data never acts as a credential.

## Audit

Audit is a cross-cutting security concern. `audit_logs` and `audit_log_changes` record security-sensitive and operationally relevant actions without becoming part of the user/profile aggregate.

Audit records may reference an authentication identity, but must never contain passwords, password hashes, bearer tokens, or other secret material in plaintext.

## Dependency direction

```text
Authentication identity
        |
        +--> Credential
        +--> Security state
        +--> Session
        +--> 2FA
        +--> User profile
        +--> Authorization assignment
        +--> Audit actor reference

Authentication (AuthN) ---------> Authorization (AuthZ)
        |                              |
        | proves identity              +--> roles / permissions
        |
        +---------------------------> Audit (cross-cutting)
```

The arrows represent references/contracts, not shared ownership. Each persistence boundary has exactly one owner.

## Ownership matrix

| Persistence table | Owner | Boundary |
|---|---|---|
| `authentication_users` | Authentication | Identity |
| `authentication_user_credentials` | Authentication | Credential |
| `authentication_user_profiles` | User Management | Profile |
| `authentication_user_security` | Security | Security state |
| `authentication_user_sessions` | Security | Session |
| `authentication_user_two_factors` | Security | 2FA |
| `authorization_roles` | Authorization | Role |
| `authorization_permissions` | Authorization | Permission |
| `authorization_user_roles` | Authorization | User-role assignment |
| `authorization_role_permissions` | Authorization | Role-permission assignment |
| `audit_logs` | Audit | Audit |
| `audit_log_changes` | Audit | Audit detail |

Ownership means the owning module is the only boundary allowed to define and mutate that persistence concern directly. Other modules consume explicit application contracts rather than reaching into another module's repository or persistence implementation.

## Security invariants

1. `authentication_users` is the single authentication identity source of truth.
2. Password material exists only in the credential boundary.
3. Profile data cannot establish or mutate authentication/security state implicitly.
4. Session and 2FA are security resources, not profile or credential fields.
5. Roles and permissions are authorization data, not authentication data.
6. Audit data is cross-cutting and secret-safe.
7. Persistence ownership is explicit and non-ambiguous.
8. Prisma remains an infrastructure concern and is not imported by domain/application code.
