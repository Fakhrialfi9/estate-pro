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
