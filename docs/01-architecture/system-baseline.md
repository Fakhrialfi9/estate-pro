# Estate Pro — SYSTEM Baseline Audit

## Step

- Roadmap step: **01 — Baseline audit SYSTEM**
- Scope: existing SYSTEM only
- Branch: `main`
- Purpose: reconcile the SYSTEM roadmap with the repository's actual implementation before any new capability is built.

## Audit rule

This baseline is an inventory and classification document. It does not redefine ownership and it does not justify rebuilding existing components.

Repository evidence remains the source of truth. Where repository evidence is insufficient to prove a runtime or infrastructure property, the item is marked as an open verification point rather than assumed to be complete.

## 1. Current SYSTEM structure

`SystemModule` already exists and is layered into presentation, application, domain, and infrastructure areas. The module currently imports `DatabaseModule`, `AuditModule`, `AuthModule`, `PermissionsModule`, `AuthorizationModule`, and `AutomationModule`.

Current SYSTEM controllers:

- `AuditLogsController`
- `SettingsController`
- `ActivityController`
- `NotificationsController`
- `JobsController`

Current SYSTEM application services:

- `SystemSettingsService`
- `SystemActivityService`
- `SystemNotificationService`
- `SystemJobOperationsService`

Current SYSTEM repositories/adapters:

- `PrismaSystemSettingsRepository`
- `PrismaSystemActivityRepository`

The module wiring uses repository ports for Settings and Activity and exposes the corresponding application services while keeping persistence implementations inside infrastructure.

## 2. Existing ownership boundaries

| Capability | Current owner | SYSTEM role | Status |
|---|---|---|---|
| Settings | System | Typed operational settings API and application service | **EXISTING** |
| Activity | System | Operational timeline/read model | **EXISTING** |
| Audit persistence | Audit module | Query/operational surface only | **EXISTING / REUSE** |
| Notifications | Automation notification contract | User-facing System API surface | **EXISTING / REUSE** |
| Job execution | Automation module | Operational facade for execution controls | **EXISTING / REUSE** |
| Health | Health module | Consume/integrate; do not duplicate health ownership | **EXISTING / REUSE** |
| Logging | Infrastructure | Structured logging consumed by SYSTEM | **EXISTING / REUSE** |
| Telemetry | Infrastructure | Correlation/metrics/tracing integration | **EXISTING / REUSE** |
| Authentication | Auth module | Consumer only | **EXISTING / REUSE** |
| Authorization | Authorization module | Consumer only | **EXISTING / REUSE** |
| Permissions | Permissions module | Consumer only | **EXISTING / REUSE** |
| Database | Database/Prisma infrastructure | Consumer through repository/contracts | **EXISTING / REUSE** |
| Import | None identified as an implemented SYSTEM capability | Future System capability | **MISSING** |
| Export | None identified as an implemented SYSTEM capability | Future System capability | **MISSING** |
| Webhooks | No implemented SYSTEM webhook subsystem identified | Future System capability | **MISSING** |
| Integrations | No provider-neutral System integration framework identified | Future System capability | **MISSING** |

## 3. Capability classification

### 3.1 EXISTING

These capabilities are already implemented and must not be rebuilt:

- Settings foundation.
- Activity foundation.
- Audit consumption/query surface.
- Notification System facade over Automation.
- Job System facade over Automation.
- Authentication boundary via existing Auth module.
- Authorization boundary via existing Authorization module.
- Permission boundary via existing Permissions module.
- Health boundary via existing Health module.
- Logging/telemetry via infrastructure.
- Database access through the existing Prisma/Database infrastructure.

### 3.2 PARTIAL

The following existing areas have a foundation but are not yet sufficient to satisfy the complete SYSTEM roadmap:

- **Settings:** existing registry, validation, optimistic-versioning behavior, audit integration, and API are present, but the roadmap still calls for explicit lifecycle/concurrency/security/API regression verification and any evidence-backed hardening.
- **Activity:** append/list and centralized metadata redaction are present, but the roadmap calls for fuller querying, detail semantics, retention, export contract preparation, and security regression verification.
- **Audit operations:** the query surface exists through SYSTEM, but the roadmap requires explicit semantic separation from Activity and integrity/security verification without introducing a second audit persistence layer.
- **Notifications:** the System service delegates to the existing Automation notification contract, but the roadmap calls for completion of query, detail/read, batch-read, expiry, security, and operational state behavior where supported by the current contract.
- **Jobs:** SYSTEM already delegates list/detail/retry/cancel operations to Automation, but the roadmap calls for lifecycle normalization, operational hardening, audit coverage, and concurrency/idempotency verification.

### 3.3 MISSING

The following roadmap capabilities are not established as implemented SYSTEM subsystems in the inspected repository state:

- Generic import foundation and import pipeline.
- Generic export foundation and export pipeline.
- Webhook subscription and signed delivery subsystem.
- Provider-neutral integration registry/adapter framework.
- System-wide operational capabilities that depend on these new foundations, such as related artifact lifecycle and recovery surfaces.

These are future implementation scopes. They must be introduced incrementally and must not take ownership away from Automation, Audit, Health, Auth, Authorization, Permissions, or infrastructure.

### 3.4 CONFLICT

No direct architecture conflict is required by Step 01. The main constraint is that future work must follow the already-documented System boundary: SYSTEM may consume public application contracts but must not reach into another module's private repository implementation.

### 3.5 NOT REQUIRED

The following are explicitly out of scope for reconstruction because the repository already provides them:

- Second Audit persistence engine.
- Second notification engine.
- Second job/queue/scheduler engine.
- Second HealthModule.
- Second authentication or authorization framework.
- Second database abstraction.
- New observability stack.

## 4. Current data and application flow

### Settings

`SettingsController` → `SystemSettingsService` → `SystemSettingsRepository` → Prisma persistence.

Successful updates also use the existing Audit contract and System Activity repository. Sensitive setting values are intentionally redacted in the audit change record.

### Activity

System/application callers → `SystemActivityService` → `SystemActivityRepository` → persistence.

Activity metadata is centrally redacted before persistence for keys matching sensitive credential/token/secret patterns.

### Notifications

`NotificationsController` → `SystemNotificationService` → `AutomationNotificationPort` → Automation-owned notification persistence/behavior.

SYSTEM therefore remains a user-facing/operational facade instead of creating notification persistence.

### Jobs

`JobsController` → `SystemJobOperationsService` → `AutomationSystemPort` → Automation execution engine.

Retry and cancel requests therefore remain commands to the existing Automation owner.

### Authorization

Protected SYSTEM endpoints use the existing authentication/authorization boundary rather than introducing a separate permission engine.

## 5. Architecture assessment

### Confirmed strengths

- SYSTEM follows the repository's existing Presentation/Application/Domain/Infrastructure layering.
- Settings and Activity use application-facing repository ports rather than controllers directly accessing Prisma.
- Notifications and Jobs consume explicit Automation contracts.
- SYSTEM is already documented as an operational boundary instead of a business-domain owner.
- Existing architecture documentation explicitly forbids SYSTEM from reaching into private repositories owned by other modules.

### Baseline risks / follow-up verification points

1. The SYSTEM root composition is becoming a significant integration hotspot because it connects to several cross-cutting modules.
2. Refresh/login/audit reliability concerns identified elsewhere in the repository remain relevant to future System security operations; future System changes must avoid increasing this coupling accidentally.
3. Runtime scalability and production topology cannot be fully proven from static repository inspection alone.
4. Historical-data retention for activity, audit, jobs, artifacts, and future imports/exports/webhooks must be designed with explicit owners before implementation.

## 6. Security baseline

The inspected SYSTEM boundary is protected through existing security infrastructure rather than a parallel mechanism. Future privileged operations must continue to use:

- `AuthModule` for authentication.
- `AuthorizationModule` for authorization.
- `PermissionsModule` for explicit permission semantics.
- Existing resource-scoping mechanisms when the operation is not global.
- `AuditModule` for immutable security/compliance events.

Sensitive values must remain outside ordinary System operational data and logs, including:

- passwords;
- access/refresh tokens;
- API keys;
- webhook secrets;
- database credentials;
- private keys;
- raw credential payloads.

Future import/export/webhook/integration work must treat all external content and outbound destinations as untrusted.

## 7. Database baseline

The repository uses Prisma with a split schema layout under `prisma/schema`, and the application uses the existing MariaDB adapter and centralized database configuration.

No Step 01 migration is required. Existing Settings/Activity/Audit/Automation persistence must be reused unless a later roadmap step presents evidence that the current schema cannot satisfy a concrete requirement.

Any later migration must first inspect:

- current schema;
- existing indexes;
- foreign keys;
- uniqueness constraints;
- existing repositories;
- existing migrations;
- backward-compatibility impact.

## 8. Testing baseline

The repository has dedicated test configuration/surfaces for unit, integration, E2E, security, OpenAPI, and coverage validation. Existing refresh-token lifecycle and security tests provide examples of the repository's preferred regression style.

Step 01 does not add a new runtime behavior. Its purpose is to establish the inventory used to scope subsequent tests without duplicating the existing test architecture.

## 9. SYSTEM roadmap starting point

The roadmap should therefore proceed as follows:

1. **Step 01 — Baseline audit:** establish and preserve this baseline.
2. **Step 02 — Ownership boundary:** formalize the boundaries already represented here.
3. **Step 03 — Dependency direction:** enforce architecture rules against private cross-module dependencies.
4. **Step 04 — Public contracts:** define/standardize System ports only where needed.
5. **Step 05 — Error model:** normalize System-specific errors.
6. Continue to Settings/Activity/Notification/Job completion before introducing missing Import/Export/Webhook/Integration capabilities.

## 10. Step 01 acceptance criteria

Step 01 is complete when:

- the existing SYSTEM module has been inventoried;
- existing controllers/services/repositories have been mapped;
- capability status is classified as EXISTING/PARTIAL/MISSING/CONFLICT/NOT REQUIRED;
- ownership boundaries are explicit;
- reusable infrastructure is identified;
- missing capabilities are separated from existing capabilities;
- no duplicate subsystem is proposed;
- future steps have a clear baseline to reference.

## Evidence references

- `src/modules/system/system.module.ts`
- `src/modules/system/presentation/*`
- `src/modules/system/application/services/system-settings.service.ts`
- `src/modules/system/application/services/system-activity.service.ts`
- `src/modules/system/application/services/system-notification.service.ts`
- `src/modules/system/application/services/system-job-operations.service.ts`
- `src/modules/system/infrastructure/persistence/*`
- `docs/01-architecture/system-boundary.md`
- `docs/01-architecture/module-architecture.md`
- `docs/01-architecture/dependency-rules.md`
- `docs/01-architecture/data-flow.md`
