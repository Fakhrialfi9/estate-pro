# System Capability Matrix

| Capability | Owner | System API responsibility | Data owner | Privilege model |
|---|---|---|---|---|
| Settings | System | Read/update typed operational settings | System | `system.settings.read` / `system.settings.update` |
| Activity | System | Query operational timeline | System | `system.activity.read` |
| Audit | Audit module | Expose audit query surface | Audit | `audit:read` through existing authorization |
| Jobs | Automation module | Operational query/retry/cancel surface | Automation | `system.jobs.*` + existing owner scope |
| Notifications | Automation module | User-scoped notification query/read surface | Automation | `system.notifications.read` |
| Import/Export | System | File boundary/orchestration only after concrete domain mapping exists | Domain-specific | Explicit domain permission |
| Webhooks | System | Signed outbound delivery contract | System | Explicit admin permission |
| Integrations | System | Provider ports/config/status | Provider/domain-specific | Explicit provider permission |
| Health | Health module | Liveness/readiness remains owned by HealthModule | Infrastructure | Public operational surface |
| Observability | Infrastructure | Correlation/logging/metrics/tracing | Infrastructure | No business ownership |

## Dependency rules

1. Presentation depends on System application services.
2. System application code depends on domain ports/contracts, not Prisma.
3. Prisma implementations remain in infrastructure.
4. System may consume another module's public application contract, such as `AutomationService`; it must not access that module's private repository implementation.
5. Audit and Health remain owned by their existing modules; System must not create competing stores or health checks.
6. Authentication and authorization remain owned by Auth/Permissions infrastructure.

## Status rule

A capability is not considered implemented solely because a controller exists. Its persistence, authorization, error handling, tests, and operational behavior must all be verifiable.
