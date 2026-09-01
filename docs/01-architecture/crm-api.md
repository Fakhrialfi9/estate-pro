# CRM API conventions

Base path: `/api/v1/crm`.

Private CRM management endpoints require JWT authentication plus an explicit CRM permission. Public inquiry intake is isolated in the dedicated public controller.

List endpoints use bounded pagination with explicit resource-level filter DTOs and an allowlisted set of sort fields. Clients cannot inject arbitrary Prisma `where` or `orderBy` structures.

Public responses use the repository's `{ data, meta? }` envelope. Internal BigInt persistence identifiers are not exposed by the CRM response serializer.

OpenAPI should document UUID parameters, request DTOs, lifecycle/status enums, authorization requirements, and relevant 400/401/403/404/409 responses for each public management operation.

## Audit baseline

The CRM implementation is built around the existing NestJS module boundary, application service, domain repository ports, Prisma persistence adapter, existing authorization guards, audit repository, and public Property/User contracts. STEP 62–127 work must extend these existing boundaries rather than introducing a second CRM architecture or direct controller-to-Prisma access.
