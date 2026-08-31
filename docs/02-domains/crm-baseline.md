# CRM baseline audit

Audit date: 2026-09-01.

## Existing implementation

The CRM bounded context is already implemented beyond a scaffold. It contains Prisma persistence, application services, lifecycle handling, private/public controllers, authorization integration, audit integration, seeded CRM permissions, and a committed CRM migration.

## Boundary

CRM owns Contacts, Leads, Inquiries, Activities, Communications, relationship workflows, assignment, scoring, duplicate review/merge, and lifecycle orchestration. Users/Auth owns identity and authorization. Property owns property business data. CRM references User and Property through public contracts and UUIDs rather than internal repositories.

## Existing conventions preserved

The repository uses NestJS modules, Presentation -> Application -> Domain -> Repository Port -> Infrastructure separation, Prisma under infrastructure persistence, UUID public identifiers with unsigned BigInt internal persistence IDs, `{ data, meta? }` API envelopes, global validation, JWT plus AuthorizationGuard, and application-boundary audit logging.

## Relevant remediation during STEP 1–61

- The CRM migration had a MariaDB identifier-length failure on the generated Contact Relationship compound unique key. The committed SQL now uses a MariaDB-safe short constraint name.
- CRM child mutations are scoped by parent Contact UUID.
- Lead duplicate detection stores source and candidate IDs correctly and merge handles overlapping tags without violating the composite unique key.
- Lead score persistence increments `scoreVersion`.
- Lead archive persists the ARCHIVED lifecycle status.
- Inquiry conversion no longer accepts arbitrary raw internal Contact IDs.
- CRM service validates User/Property references through public contracts.
- CRM DTOs enforce bounded fields, UUID formats, query sort allowlists, status/channel enums, and template/score-rule constraints.

## Validation principle

No CRM step is considered complete from documentation or compilation alone. Every relevant behavior must be validated through unit, integration, E2E, database/migration, security, architecture, OpenAPI, and build checks available in the repository.
