# Prisma Seed Architecture

Seeds are organized by bounded domain so each seed module owns only the data and relationships it creates.

```text
prisma/
├── seed.ts                    # Prisma CLI entrypoint only
└── seeds/
    ├── config.ts              # Environment-driven seed configuration
    ├── database.ts             # Prisma adapter/client and transaction type
    ├── runner.ts               # Transaction + deterministic execution order
    ├── permissions/
    │   ├── data.ts             # Permission definitions
    │   └── seed.ts              # Permission upsert logic
    ├── roles/
    │   ├── data.ts             # Role definitions
    │   └── seed.ts              # Role + role-permission assignment
    └── users/
        ├── data.ts             # Seed user definitions
        └── seed.ts              # User credentials/security + user-role assignment
```

## Execution order

The orchestrator intentionally keeps the dependency order explicit:

1. Permissions
2. Roles
3. Role-permission assignments
4. Users and credentials/security
5. User-role assignments

All steps execute inside one Prisma transaction so a failed seed does not leave partial bootstrap state.

## Adding a new domain

Create a domain folder under `prisma/seeds/<domain>/` with:

- `data.ts` for deterministic definitions
- `seed.ts` for persistence logic

Only `runner.ts` should coordinate cross-domain dependencies. Keep Prisma connection setup in `database.ts` and environment values in `config.ts`.

Seed modules must remain idempotent by using Prisma `upsert` with stable unique keys.
