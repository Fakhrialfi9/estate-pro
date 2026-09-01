# Sales Management Baseline and Release Contract

## Boundary

Sales owns pipelines, pipeline stages, sales opportunities, activities, viewings, negotiations, offers, deals, deal items, closings, lost-reason reference data, commissions, and forecast queries. CRM owns leads/contacts and invokes Sales through `SalesConversionPort`. Property owns property data; Sales stores public `propertyUuid` references only. Users/Auth/Authorization owns identity and permission resolution. Audit owns immutable audit records.

## CRM → Sales

The existing public contract remains `SalesConversionPort.createFromQualifiedLead(input)`. CRM verifies `QUALIFIED`, uses an idempotency key, invokes Sales, and then marks the CRM lead converted. Sales prevents duplicate opportunities using the existing lead identity and idempotency mechanism.

## Lifecycle

Opportunity: `OPEN -> QUALIFIED -> NEGOTIATING -> WON|LOST -> ARCHIVED`.

Viewing: `REQUESTED -> CONFIRMED -> COMPLETED|CANCELLED|NO_SHOW`.

Negotiation: `OPEN -> ACTIVE -> ACCEPTED|REJECTED -> CLOSED`.

Offer: `DRAFT -> SUBMITTED -> ACCEPTED|REJECTED|EXPIRED`.

Deal: `OPEN -> IN_PROGRESS -> READY_TO_CLOSE -> CLOSED`, with terminal `LOST` and `CANCELLED` branches.

Activity: `OPEN -> COMPLETED|CANCELLED`.

Generic lifecycle `status` PATCH is not the authoritative workflow. Explicit command endpoints own transitions.

## Authorization

All Sales HTTP routes are private and use the existing JWT + `AuthorizationGuard` architecture. Sales permissions are explicit by resource and action. Resource-level checks scope opportunities/deals to the actor unless a privileged Sales management permission is present.

## Money and forecast

Sales monetary columns use MySQL `DECIMAL(19,4)`. Commission calculations are derived from authoritative deal/closing data; the client cannot submit the authoritative commission amount. Forecast uses derived weighted pipeline value: `opportunity.valueAmount * stage.probability / 100`. Snapshot materialization is deferred until measured workload justifies it.

## Audit

Critical Sales mutations emit centralized audit actions. Audit payloads exclude credentials, tokens, and unnecessary PII. The existing `AuditModule` remains the single audit boundary.

## Performance and release

Collections use bounded pagination and deterministic ordering. Indexes target the observed owner/status, pipeline/stage, property, schedule, offer-version, deal, and commission query paths. Existing repository quality gates remain authoritative for lint, typecheck, architecture, tests, security, OpenAPI, migration, build, runtime, Docker, recovery, and repository cleanliness.
