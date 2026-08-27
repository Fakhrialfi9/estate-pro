# Property Domain Specification

## Scope

This document establishes the **PHASE 0 — PROPERTY DOMAIN FOUNDATION** contract only. It does not implement Property CRUD, HTTP endpoints, Prisma models, migrations, or a new authorization/audit framework.

The repository currently contains a `src/modules/property` scaffold but no implemented Property aggregate or Property persistence model. The Property module is therefore treated as a bounded-context target and architectural contract, not as an implemented feature.

## 1. Repository and architecture boundary

Estate Pro uses an explicit NestJS module structure with Presentation, Application, Domain, and Infrastructure concerns. Dependency direction is `Presentation → Application → Domain ← Infrastructure`. Domain/application code must not depend directly on HTTP, NestJS controllers, Prisma, or database adapters.

Existing reusable cross-cutting infrastructure remains authoritative:

- Authentication: existing JWT authentication and `JwtAuthGuard`.
- Authorization: existing `AuthorizationGuard` and permission/role decorators.
- Validation: existing global `SecureValidationPipe` and DTO validation strategy.
- Errors: existing domain/application/infrastructure exceptions and `GlobalExceptionFilter`.
- Audit: existing `AuditLogService` / audit persistence and redaction facilities.
- Persistence: existing Prisma access remains behind the infrastructure boundary.
- Testing and architecture checks: existing Vitest, TypeScript, ESLint, Prettier, Prisma, and architecture validation conventions.

No new cross-cutting framework is introduced by Property.

## 2. Database audit and ownership

The Prisma schema is split into schema fragments under `prisma/schema`, with migrations managed under `prisma/migrations`. The repository currently has no Property Prisma model and no Property migration. The Property schema directory is a scaffold only.

Existing user/security/authorization/audit resources keep their existing logical owners. Physical database co-location does not create shared ownership.

| Resource / boundary | Owner | Property relationship |
|---|---|---|
| Property aggregate data | `property` | Property-owned; to be introduced in the CRUD phase |
| Canonical media resources | `property`/`media` boundary as later decided by implementation | Property stores references; do not assume shared persistence |
| Listings/market listing workflow | `sales`/listing boundary | Separate aggregate/boundary; reference Property |
| Canonical geographic/location data | Location/master-data boundary | Reference only when owned elsewhere |
| Ownership / agent assignment | CRM/users/ownership boundary according to final schema | Reference only; no foreign-domain table writes from Property |
| `authentication_users` | `auth` | Identity reference only |
| Authorization resources | `roles` / `permissions` | Permission checks through existing authorization boundary |
| `audit_logs`, `audit_log_changes` | `audit` | Cross-cutting audit records |

Property must never reach another domain's repository or Prisma model directly. A foreign key to a domain-owned table is an identity/reference relationship, not shared table ownership.

No destructive migration is part of Phase 0.

## 3. Authorization boundary

Property uses the existing authorization stack. The expected future request path is:

`HTTP request → JwtAuthGuard → AuthorizationGuard → Property application use case`

Property must use existing role/permission metadata and current-user resolution. It must not introduce another role model, permission registry, guard, decorator family, or authorization service.

Exact Property permission codes are an implementation detail for the CRUD phase and must follow the repository's existing permission naming/seed conventions. Ownership checks are business rules in the Property application/domain boundary, not controller logic.

## 4. Audit boundary

Property reuses the existing audit logging mechanism, including actor/resource tracking, result, request/correlation context, before/after changes where applicable, and sensitive-data redaction.

Required Property mutation event taxonomy is:

- `PROPERTY_CREATED`
- `PROPERTY_UPDATED`
- `PROPERTY_DELETED`
- `PROPERTY_REVIEWED`
- `PROPERTY_VERIFIED`
- `PROPERTY_PUBLISHED`
- `PROPERTY_ARCHIVED`
- `PROPERTY_RESTORED`
- `PROPERTY_DUPLICATED`

A rejected state transition may be represented as a failure audit event when the application use case executes the auditable mutation attempt. Audit events must identify the actor and Property resource without exposing sensitive/internal values.

Audit logging remains a cross-cutting concern; Property does not own the audit tables.

## 5. Validation contract

Property DTOs must use the repository's global validation strategy. The existing bootstrap configures `SecureValidationPipe` with:

- `transform: true`
- `whitelist: true`
- `forbidNonWhitelisted: true`
- `forbidUnknownValues: true`
- no implicit primitive conversion unless explicitly enabled by a future DTO rule

Property input validation must be explicit for:

- required versus optional fields;
- string length and content constraints;
- numeric ranges and precision requirements;
- enum members;
- UUID/public identifiers when applicable;
- dates/date-time values;
- arrays and collection size;
- nested DTOs and nested validation.

Business invariants remain outside DTOs. DTOs validate shape; application/domain code validates business meaning.

## 6. Response and error contract

Property endpoints must reuse the repository's existing controller/serializer and exception conventions. Prisma/database representations must not leak directly to API consumers.

The current error contract is normalized by `GlobalExceptionFilter` into:

```text
statusCode
code
message
path
timestamp
```

Request/correlation identifiers remain available through the existing request context/header/logging mechanism; Property must not invent a second response envelope.

Database exceptions continue to be translated by the existing filter (for example unique conflicts, relation/constraint failures, not-found, and database availability) without exposing raw SQL or Prisma internals.

Property-specific business error codes should be stable and namespaced, for example:

- `PROPERTY_NOT_FOUND`
- `PROPERTY_DUPLICATE`
- `PROPERTY_INVALID_STATE`
- `PROPERTY_INVALID_TRANSITION`
- `PROPERTY_OWNERSHIP_VIOLATION`
- `PROPERTY_RELATED_RESOURCE_NOT_FOUND`
- `PROPERTY_CONFLICT`

`UNAUTHORIZED`, `FORBIDDEN`, validation, and generic infrastructure error handling remain the existing cross-cutting contract.

## 7. Property bounded context

Property is an explicit business bounded context under `src/modules/property`.

### Property owns

- Property identity within its aggregate.
- Property business attributes that define the property itself.
- Property lifecycle state and lifecycle invariants.
- Property-specific codes/slugs/identifiers once approved by the database design.
- Application use cases that mutate or query the Property aggregate.

### Property does not own

- Authentication credentials or sessions.
- User roles or permission definitions.
- Audit log persistence.
- Sales transaction/commission workflow.
- CRM customer/leads workflow.
- External media storage implementation.
- Canonical master-data resources that have a separate owner.

### Cross-domain interaction

Cross-domain interactions are explicit through application/service contracts or reference identifiers. Property never performs direct Prisma access to another bounded context's persistence tables.

## 8. Aggregate boundary

`Property` is the aggregate root for the Property domain.

Only state that must be changed atomically with the Property aggregate belongs inside this aggregate. Likely value-object candidates include identifiers, codes/slugs, and constrained address/location representations, but these remain design decisions until the CRUD/schema phase establishes the actual fields.

The following are treated as separate aggregate/bounded-context candidates rather than automatically embedded inside Property:

- media assets;
- listings/market offerings;
- sales transactions;
- agent/customer relationships;
- canonical master-data entities;
- audit records.

Cross-aggregate references use stable IDs and application/domain ports. Property must not become a God aggregate for every related resource.

## 9. Application use-case boundary

The planned Property application use cases are:

| Use case | Actor | Main rule | State/transaction/audit direction |
|---|---|---|---|
| Create property | Authorized user | Create a valid Property aggregate | Atomic write; `PROPERTY_CREATED` |
| Update property | Authorized user/owner policy | Only mutable fields in an allowed state | Atomic write; `PROPERTY_UPDATED` |
| Delete property | Authorized user/owner policy | Respect deletion policy and current state | Atomic when multi-write; `PROPERTY_DELETED` |
| Get property | Authorized/public policy per endpoint | Return stable read model | Read-only |
| List properties | Authorized/public policy per endpoint | Exclude deleted/non-visible records according to visibility rules | Read-only |
| Review property | Reviewer with appropriate permission | Only valid review transition/decision | Atomic; `PROPERTY_REVIEWED` |
| Verify property | Verifier with appropriate permission | Required checks must pass | Atomic; `PROPERTY_VERIFIED` |
| Publish property | Authorized publisher | Only a publishable Property can become active | Atomic; `PROPERTY_PUBLISHED` |
| Archive property | Authorized user | Only allowed active state may be archived | Atomic; `PROPERTY_ARCHIVED` |
| Restore property | Authorized user | Only allowed archived/deleted state may be restored | Atomic; `PROPERTY_RESTORED` |
| Duplicate property | Authorized user | Produce a new Property identity; never copy identity/ownership/audit history blindly | Atomic creation; `PROPERTY_DUPLICATED` |

Controllers remain thin: authentication/authorization metadata, DTO binding, and serialization only. Business rules live in application/domain layers.

## 10. Read model

The API contract is a read model, independent from the Prisma schema.

### Property summary

Intended stable fields include:

- public Property identifier;
- property code when applicable;
- title/name;
- lifecycle status;
- high-level location label;
- key commercial/property facts;
- primary media reference when available;
- created/updated timestamps required by the public contract.

### Property detail

The detail read model may add explicit sections for:

- Property identity and public metadata;
- descriptive attributes;
- structured location data;
- ownership/agent references allowed for the caller;
- status/lifecycle metadata;
- explicit media items;
- selected master-data references;
- safe metadata.

Internal database IDs, deleted records, security fields, audit internals, and ORM-specific relation structures are excluded unless explicitly part of the public contract.

A serializer/mapper defines the API shape. A Prisma record is not itself a response DTO.

## 11. Naming convention

Property naming follows the repository's existing conventions:

- Prisma/TypeScript model field style: `camelCase`.
- Physical SQL names use explicit `@map(...)`/`@@map(...)` when the repository schema requires snake_case.
- Primary persistence identifier follows the existing database pattern; current user persistence demonstrates an internal numeric `id` plus public `uuid`. Property must not invent a conflicting identifier convention.
- Public identifier, internal database ID, property code, and slug are distinct concepts and must never be conflated.
- Foreign keys use the related resource name plus `Id` (for example, `ownerId`) when a scalar FK is introduced.
- Timestamps follow `createdAt` / `updatedAt`; physical columns follow existing mapping conventions.
- Soft deletion, if adopted by the Property schema, follows `deletedAt` and default queries exclude deleted records.
- TypeScript types/classes use PascalCase; variables/functions use camelCase; enums follow existing project naming conventions.
- Unique constraints must be explicit in the persistence schema; application checks alone are not a substitute for database uniqueness.

Property-specific public code and slug semantics remain design decisions until the schema is introduced; no unsupported uniqueness assumption is made here.

## 12. Lifecycle / state machine

The foundation defines the canonical lifecycle as:

`Draft → Review → Active → Archived`

`Restore` permits `Archived → Active` when the business policy allows it.

`Verify` is a verification decision/action and must not automatically imply a state transition unless the eventual domain model explicitly requires it. `Publish` is the state transition into `Active`.

### Supported transitions

| From | Command | To | Rule |
|---|---|---|---|
| none | Create | Draft | Aggregate is newly created |
| Draft | Review | Review | Required draft data must be valid |
| Review | Publish | Active | Publish requirements must be satisfied |
| Active | Archive | Archived | Caller has archive permission |
| Archived | Restore | Active | Restore policy permits reactivation |

`Sold` and `Rented` are intentionally **not** modeled as current Property states because the repository has not yet established those states in a Property schema. They remain future domain decisions, not assumptions.

Delete semantics are intentionally separate from lifecycle state. The eventual persistence design must decide whether deletion is soft-delete, hard-delete, or a domain-specific removal policy; the default listing/read policy must follow that decision.

Any unsupported transition must be rejected through the existing domain/application exception mechanism and must not silently mutate the entity.

## 13. Error contract

Property maps business conditions to stable application/domain codes while reusing the existing HTTP/error infrastructure.

| Condition | Contract direction |
|---|---|
| Property not found | `PROPERTY_NOT_FOUND` / existing not-found handling |
| Duplicate Property | `PROPERTY_DUPLICATE` / HTTP conflict |
| Invalid Property state | `PROPERTY_INVALID_STATE` |
| Invalid transition | `PROPERTY_INVALID_TRANSITION` |
| Validation failure | Existing ValidationPipe/HTTP contract |
| Unauthenticated | Existing `UNAUTHORIZED` contract |
| Unauthorized action | Existing `FORBIDDEN` contract |
| Constraint violation | Existing database mapping, sanitized |
| Ownership violation | `PROPERTY_OWNERSHIP_VIOLATION` |
| Missing related resource | `PROPERTY_RELATED_RESOURCE_NOT_FOUND` |
| Generic business conflict | `PROPERTY_CONFLICT` |

Infrastructure exceptions must remain distinguishable from domain errors. Raw SQL, stack traces, driver messages, and sensitive persistence details must not be returned to clients.

## 14. Transaction boundary

The application use case owns the transaction boundary. The repository layer provides persistence operations; it does not decide business transaction semantics.

Operations requiring atomic multi-write semantics include:

- Property creation when required relations/audit records are persisted together;
- multi-field aggregate updates;
- lifecycle transitions that update Property plus required domain records;
- duplicate when creating the new aggregate includes mandatory dependent writes;
- archive/restore/delete when more than one owned persistence record must change.

The desired transaction shape is:

```text
BEGIN
  validate application/domain invariants
  persist Property aggregate changes
  persist required owned relation changes
  persist required audit record
COMMIT
```

On failure, the database work rolls back so the operation cannot leave mandatory writes partially committed.

Read-only queries do not need a transaction merely for consistency unless a specific future read model requires a transactional snapshot.

External side effects such as object-storage uploads, emails, webhooks, or third-party calls must not be falsely treated as ACID operations inside a relational transaction. If they become required, a later outbox/after-commit strategy must be designed explicitly.

## 15. Domain invariants

The following invariants are supported by the architectural requirements and are safe foundations:

1. A Property must always be in one valid lifecycle state.
2. Lifecycle transitions may only use explicitly allowed commands.
3. A Property mutation must pass existing authentication/authorization policy.
4. Property must not directly mutate another bounded context's persistence.
5. Database-level unique constraints, where required, are authoritative for uniqueness.
6. API output must never automatically expose ORM/database internals.
7. Deleted/removed Properties must not appear in default listing/read paths when the eventual deletion policy is soft deletion.
8. Archived Properties may only be modified through explicitly allowed commands.
9. Publishing requires all required publish invariants defined by the final domain schema and business policy.
10. A duplicate Property receives a new identity and must not copy audit history, internal persistence identity, or another entity's ownership blindly.
11. Any invariant that cannot yet be derived from the existing repository/schema is a **design decision**, not an implementation assumption.

Examples deliberately left open until the schema phase: whether `propertyCode` is mandatory, whether `slug` is mandatory, the exact ownership relationship, the exact required fields before publish, and whether Sold/Rented are lifecycle states.

## 16. Cross-domain dependency rules

Property dependencies must point inward to contracts, not outward to foreign persistence details:

```text
Property Presentation
        ↓
Property Application
        ↓
Property Domain
        ↑
Property Infrastructure
        ↓
Owned Property persistence
```

Cross-cutting infrastructure remains shared through existing public contracts. Foreign-domain resources are accessed through their public/application boundary or stable references.

Forbidden pattern:

```text
Property Repository
      ↓
Prisma
      ↓
Other Domain Table
```

## 17. Future CRUD boundary

Phase 1 may implement the Property CRUD and workflow endpoints under the existing module scaffold, following this specification. Expected boundaries are:

- `presentation`: controllers, DTOs, serializers;
- `application`: use cases and application services;
- `domain`: aggregate, entities/value objects, repository/service contracts;
- `infrastructure`: Prisma persistence, mapping, repository implementation.

Phase 1 must not turn controllers into business services, leak Prisma types into application/domain code, or introduce a second authorization/audit/error/validation framework.

## 18. Phase 0 verification evidence

Repository evidence reviewed for this specification includes:

- `src/modules/property` scaffold;
- `src/app.module.ts` and Nest bootstrap;
- existing architecture and dependency-rule documentation;
- Prisma schema fragments and migration history;
- authorization guard/decorators and permission module;
- global secure validation pipe;
- global exception filter;
- audit service and audit event taxonomy;
- database ownership documentation;
- existing package/test/build/architecture scripts.

Phase 0 deliberately does not create a Property Prisma model or HTTP CRUD implementation. The specification is the synchronization point between the audited existing architecture and the next Property CRUD phase.
