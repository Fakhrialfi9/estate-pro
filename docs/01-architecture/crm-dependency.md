# CRM dependency contract

CRM may consume public user/agent UUIDs and public Property UUIDs. It must not import another bounded context's internal repositories, Prisma models, entities or database adapters. CRM owns only its own persistence. Authorization is the existing `JwtAuthGuard` + `AuthorizationGuard` stack. Audit is the existing `SECURITY_AUDIT_REPOSITORY` port. Lists use bounded pagination and allowlisted sorting/filtering.
