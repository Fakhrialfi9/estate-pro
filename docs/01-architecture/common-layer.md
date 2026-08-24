# Common layer policy

`src/common` contains only stable concerns that are genuinely reusable across modules without acquiring domain ownership.

## Current ownership

- `constants/`: cross-cutting symbolic values that have more than one consumer.
- `enums/`: shared semantic categories used across application boundaries.
- `types/`: small structural types used by shared infrastructure.
- `exceptions/`: application/domain/infrastructure error primitives.
- `filters/`: HTTP transport mapping for cross-cutting errors.

The following directories remain extension points until a real consumer exists:

- `dto/`
- `guards/`
- `interceptors/`
- `pipes/`
- `serializers/`
- `utils/`

Empty extension points are preferable to placeholder classes. A domain-specific DTO, enum, guard, pipe, serializer, or utility belongs to its owning module.

## Dependency direction

`common` must not import:

- Prisma
- database adapters
- domain modules
- feature modules
- infrastructure services
- feature-specific DTOs or business rules

Application modules may depend on stable common primitives. Common code must remain infrastructure-neutral except where a concern is explicitly a transport boundary, such as the HTTP exception filter.
