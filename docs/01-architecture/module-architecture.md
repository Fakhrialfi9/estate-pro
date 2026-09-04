# Module Architecture

## Boundary model

Each business module is a bounded area under `src/modules/<module>`. Where implementation exists, the preferred internal layout is:

```text
<module>/
  application/      # use cases and application orchestration
  domain/           # business rules and domain model
  infrastructure/   # persistence/external adapters
  presentation/     # HTTP/controller boundary
  <module>.module.ts
```

A module may contain fewer layers while it is still a scaffold. Do not add empty abstractions merely to make the folder tree look complete.

## Current modules

| Module | Responsibility | Current state | Allowed dependency direction |
|---|---|---|---|
| Auth | Authentication-related application services and security behavior | Implemented foundation; password hashing service exists | presentation -> application; infrastructure adapters may support application contracts |
| Property | Property/real-estate business domain | Scaffold | internal layers only; public module/application contract for consumers |
| Sales | Sales/transaction business domain | Scaffold | internal layers only; public module/application contract for consumers |
| Services | Service/catalog business domain | Scaffold | internal layers only; public module/application contract for consumers |
| Content | Content management domain | Scaffold | internal layers only; public module/application contract for consumers |
| CRM | Customer relationship domain | Scaffold | internal layers only; public module/application contract for consumers |
| Users | User-management domain | Scaffold | internal layers only; public module/application contract for consumers |
| Roles | Role-management domain | Scaffold | internal layers only; public module/application contract for consumers |
| Permissions | Permission-management domain | Scaffold | internal layers only; public module/application contract for consumers |
| System | System-level operational, administrative, integration, and orchestration boundary | Implemented foundation: Settings, Activity, Audit operational surface, Notifications facade, and Jobs facade | system concerns only; must not own business-domain internals or replace dedicated engines |
| Health | Health endpoints/checks | Implemented infrastructure-facing module | health contract -> infrastructure check adapter |

## System ownership boundary

`SystemModule` is an operational boundary, not a business-domain owner. Its responsibilities include system-level settings, operational activity, administrative/read surfaces over Audit, user-scoped notification operations, job controls delegated to Automation, and future generic import/export/webhook/integration capabilities that remain behind explicit contracts.

The following ownership remains outside System:

- Authentication -> `AuthModule`
- Authorization -> `AuthorizationModule`
- Permissions -> `PermissionsModule`
- Audit persistence -> `AuditModule`
- Job/workflow execution -> `AutomationModule`
- Notification persistence/delivery execution -> `AutomationModule`
- Health checks -> `HealthModule`
- Logging/telemetry -> infrastructure
- Prisma/database access -> database infrastructure
- Property business logic -> `PropertyModule`
- CRM business logic -> `CrmModule`
- Sales business logic -> `SalesModule`

System must not create a second persistence engine, execution engine, authentication/authorization framework, health module, observability stack, or database abstraction for any of those concerns.

Cross-module collaboration must use the owning module's public contract/module boundary. System must not import another module's private application, domain, infrastructure, or presentation implementation files merely to bypass an unavailable public API.

## Public boundary rule

A module exposes only what another module genuinely needs. Prefer an application service/use-case or explicit contract/provider over importing an internal file from another module.

The architecture graph check enforces this at the source level: a module may reference another module's public `<module>.module.ts` entry point, but it may not reach into that module's `application`, `domain`, `infrastructure`, or `presentation` internals unless an explicit, reviewed exception exists for a narrow boundary adapter.

Forbidden examples:

```text
Property -> Sales/infrastructure/*
Sales -> Property/domain/internal-file
CRM -> Prisma model used by Property
Controller -> another module's repository
System -> Automation/infrastructure/private-repository
System -> Audit/infrastructure/private-repository
```

Valid cross-module collaboration should be explicit in the owning module's public API and kept as narrow as possible.

## Persistence boundary

A business module must not expose Prisma types as part of its application/domain API. Concrete Prisma repositories belong in infrastructure and implement an inner-layer abstraction.

System follows the same rule for its own persistence and must not bypass another module's repository/application boundary to read or mutate another module's data.

## Cross-boundary adapters

Health follows dependency inversion for its database check: `HealthService` consumes the small `HealthDependency` contract, while `HealthModule` binds that contract to the infrastructure-owned `DatabaseHealthService`. This keeps the health application behavior independent of Prisma implementation details.

Logging and observability are infrastructure modules. `AppModule` composes them but business modules do not import their internals.

## Composition root

`src/app.module.ts` is the composition root. It wires global configuration, structured logging, throttling, Auth, Database, Health, and Observability modules. Active business and system modules are registered explicitly when their capability is enabled.

## Scaffold rule

A scaffolded module is not a completed feature. Do not document CRUD, use cases, repositories, or controllers as implemented until the corresponding source exists and is validated.
