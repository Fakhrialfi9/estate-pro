# Dependency Rules

Estate Pro follows a pragmatic Clean Architecture dependency direction:

```text
Presentation → Application → Domain ← Infrastructure
```

## Rules

1. **Presentation** contains HTTP/controllers, transport DTOs, and framework adapters. It may depend on Application contracts/use cases, but must not contain business rules.
2. **Application** orchestrates use cases and coordinates Domain behavior. It may depend on Domain abstractions, but not on HTTP, Prisma, or other infrastructure implementations.
3. **Domain** contains business concepts and rules. It must remain independent from NestJS, Prisma, HTTP, gRPC, databases, and external services.
4. **Infrastructure** implements persistence, framework integration, external services, and other technical concerns. It may depend on Domain/Application contracts.
5. Dependencies must point inward toward Domain/Application; infrastructure details must not leak into Domain.
6. Cross-cutting concerns such as configuration are accessed through the application boundary rather than reading `process.env` throughout business code.
7. A new abstraction is justified only when it protects a meaningful boundary, supports substitution, or makes a use case materially easier to test.

## System-specific enforcement

`SystemModule` follows the same dependency direction. The architecture graph checker explicitly rejects these internal System dependencies:

```text
System/domain         -> System/application
System/domain         -> System/infrastructure
System/domain         -> System/presentation
System/application    -> System/infrastructure
System/application    -> System/presentation
System/presentation   -> System/infrastructure
System/infrastructure -> System/presentation
```

`SystemModule` itself remains the composition root for its internal providers and is therefore exempt from those layer rules. Presentation may continue to use the existing authentication guard integration already recorded in the architecture allow-list; this is a security-boundary adapter, not a replacement authorization mechanism.

The same graph checker also rejects circular dependencies and illegal cross-module imports. Cross-module collaboration must use the owning module's public boundary unless an explicit, reviewed compatibility exception is recorded.
