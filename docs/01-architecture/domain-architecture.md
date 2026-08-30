# Domain Architecture

## Bounded contexts
| Context | Responsibility | Current state |
|---|---|---|
| Users/Auth | identity, credentials, sessions, MFA | Implemented |
| Authorization | roles, permissions, access checks | Implemented |
| Property | properties, details, listing and object access | Implemented |
| Audit | security/audit persistence | Implemented |
| CRM | customer/relationship workflows | Scaffolded boundary |
| Content | content management | Scaffolded boundary |
| Services | service-domain capabilities | Scaffolded boundary |
| Sales | sales/agent workflows | Scaffolded boundary |
| System | system-level capabilities | Boundary present |

## Dependency direction
Controllers depend on application services. Application services depend on domain interfaces/policies and common security ports. Infrastructure implements those ports. Domain code does not depend on HTTP or Prisma.

## Security boundaries
Authentication establishes the principal. Authorization evaluates role/permission and resource scope. Property services enforce object-level ownership/assignment. Persistence queries include user/resource scope where a security-sensitive lookup is performed.

A valid JWT alone is insufficient: the JWT `sid` is checked against an active server-side session before protected requests are authorized.
