# Scope

## In scope
- Authentication and credential verification.
- Server-side authentication sessions.
- JWT access-token verification.
- Opaque refresh-token issuance, rotation, reuse detection, and revocation.
- Password-change/reset security-state invalidation.
- Account-state checks during login and refresh.
- MFA/TOTP and recovery codes.
- RBAC permissions and object-level property authorization.
- Security audit records and safe observability.
- HTTP validation, CORS, Helmet, throttling, health, and database persistence.
- Property domain APIs currently implemented in `src/modules/property`.

## Out of scope for the current implementation
CRM business workflows, content-management workflows, service catalog behavior, sales pipeline behavior, and future bounded-context functionality that remains scaffolded. Their module directories are architectural boundaries, not evidence of completed domain behavior.

## Boundaries
Authentication secrets are handled inside authentication/application infrastructure. Domain modules consume security ports/policies rather than reaching around their boundaries. Prisma is the persistence boundary; controllers are the HTTP boundary.
