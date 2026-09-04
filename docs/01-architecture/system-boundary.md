# System Boundary Contract

The System context owns cross-cutting operational capabilities. It does not own business-domain records and it does not replace dedicated engines.

| Capability | Owner | System responsibility |
|---|---|---|
| Settings | System | Typed, scoped configuration persisted outside secrets |
| Activity | System | Human-readable operational timeline |
| Audit | Audit module | Immutable security/compliance trail consumed by System |
| Jobs | Automation module | Workflow execution engine; System exposes operational controls |
| Notifications | Automation notification persistence + System API | User-facing notification lifecycle without a second delivery engine |
| Import/Export | System | Untrusted file boundary and orchestration around existing job/storage contracts |
| Webhooks | System | Signed outbound delivery contract and operational state |
| Integrations | System | Provider ports/config/status; provider credentials stay external |
| Health | Health module | Liveness/readiness; System does not duplicate checks |
| Observability | Infrastructure | Correlation/logging/metrics/tracing contracts |

## Dependency direction

Presentation depends on application services. Application depends on domain contracts. Infrastructure implements contracts. Domain modules must not depend on Prisma, Nest framework adapters, or transport details.

System may consume public application contracts from another module. It must not reach into another module's private repository implementation.

## Security rule

Privileged System endpoints require authentication, explicit permissions, and resource scoping where the capability is not global. Secrets, tokens, passwords, provider credentials, and private keys are never ordinary System settings or activity metadata.
