# CRM bounded context

CRM owns relationship workflows: Contacts, Leads, Inquiries, Activities, Communications, scoring, duplicate review/merge, assignment and lifecycle orchestration. Identity, user/role/permission ownership remains in Users/Roles/Permissions. Property remains Property's owner; CRM stores only public `propertyUuid` references and must validate them through the public contract when that contract is available.

## Architecture
Presentation -> Application -> Domain -> Repository Port <- Infrastructure. Prisma is infrastructure-only. Controllers map HTTP/DTOs; application services orchestrate use cases, authorization preconditions and audit; domain utilities contain normalization, lifecycle/scoring rules; Prisma repository owns persistence mapping.

## Identifiers
CRM records use public UUIDs. Internal BigInt IDs never appear in responses. Cross-context user/property references are UUID strings without CRM-owned foreign keys.

## Lifecycle
Lead statuses are configurable records, but status changes require an explicit transition row. Assignment, merge, conversion and closure are business operations rather than arbitrary PATCH fields. Activity and communication states are explicit state machines.

## Security
All private CRM endpoints require JWT + existing AuthorizationGuard permissions. Ownership-sensitive operations are checked at the application/repository boundary. PII is serialized explicitly and tokens/secrets are never accepted or persisted by CRM. Public intake is expected to remain behind the existing global rate limiter; the honeypot field is rejected when populated and message/template content is plain-text only.

## Audit
CRM mutation actions use `CRM_*` audit events with resource types such as `contact`, `lead`, `inquiry`, `activity`, `communication`, `duplicate`, and `score_rule`. Audit payloads must not contain credentials or provider secrets.
