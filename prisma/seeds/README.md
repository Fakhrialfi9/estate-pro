# Prisma Seed Architecture

The seed is a deterministic development/bootstrap dataset for the current Prisma schema. It is organized by bounded context so each module owns the records and relationships it creates.

```text
prisma/
├── seed.ts                         # Prisma CLI entrypoint only
└── seeds/
    ├── config.ts                   # Environment-driven seed configuration
    ├── database.ts                 # Prisma client/adapter + transaction type
    ├── runner.ts                   # Single transaction + dependency order
    ├── expansion.ts                # Deterministic fixture expansion to minimum dataset size
    ├── verification.ts             # Post-commit baseline coverage gate
    ├── shared/
    │   └── ids.ts                  # Stable UUIDs + reference date
    ├── permissions/
    │   ├── data.ts
    │   ├── seed.ts                 # All domain permission definitions
    │   ├── analytics.ts
    │   ├── agent-management.ts
    │   ├── content.ts
    │   ├── crm.ts
    │   ├── sales.ts
    │   └── system.ts
    ├── roles/
    │   ├── data.ts
    │   └── seed.ts
    ├── users/
    │   ├── data.ts
    │   └── seed.ts                 # Users, credentials, security, profiles
    ├── audit/
    │   └── seed.ts
    ├── agent-management/
    │   ├── data.ts
    │   └── seed.ts
    ├── property/
    │   ├── data.ts                 # Types/categories/subcategories/location/capability/property fixtures
    │   └── seed.ts
    ├── crm/
    │   ├── data.ts                 # CRM reference data
    │   └── seed.ts                 # Contact + lead fixture
    ├── sales/
    │   ├── data.ts                 # Pipeline/stage definitions
    │   └── seed.ts                 # Opportunity/negotiation/viewing fixture
    ├── property-matching/
    │   └── seed.ts                 # Preferences, scores, recommendations, feedback
    ├── automation/
    │   └── seed.ts                 # Workflow, SLA, notification and execution fixtures
    ├── content/
    │   └── seed.ts                 # CMS content, media, article/page/FAQ/testimonial fixtures
    └── system/
        ├── data.ts                 # Settings/flags/import/integration/alert definitions
        └── seed.ts                 # Control-plane runtime fixtures
```

## Execution order

The dependency order is intentionally centralized in `runner.ts`:

1. Permissions
2. Roles and role-permission assignments
3. Users, credentials, security and profiles
4. Audit bootstrap
5. Agent management
6. Property master + property aggregates
7. CRM reference data + contact/lead
8. Sales pipeline + opportunity aggregate
9. Property matching
10. Automation
11. CMS content
12. System control-plane fixtures
13. Minimum-dataset expansion
14. Post-commit verification

Every write is executed in one Prisma transaction. A failure rolls back the complete bootstrap state.

## Dataset size and deterministic variation

Every model intentionally populated by the seed is guaranteed to contain at least `SEED_MIN_RECORDS` records. The default is **10**, and the value cannot be reduced below 10. Existing fixture definitions remain the source of truth; after the domain seed completes, the expansion layer derives additional test records from those fixtures.

The additional values are **deterministic pseudo-random variants**, derived from stable hashes and the source record. This provides realistic variation without using `randomUUID()` or time-dependent randomness, so repeated `prisma:seed` runs remain idempotent and reproducible. Unique identifiers, unique codes, emails, dates and other unique scalar values are varied only when required to satisfy the existing database uniqueness rules. Foreign keys are kept valid and are remapped to expanded parent records when appropriate.

This expansion applies to every model listed in the seed coverage registry. Runtime-only or secret-bearing state that is intentionally excluded from that registry remains excluded, including active sessions, access/refresh tokens, password-reset tokens, two-factor challenges/recovery codes, webhook signing secrets, and transient import/export/queue state.

You can increase the dataset for heavier testing by setting, for example:

```bash
SEED_MIN_RECORDS=50 npm run prisma:seed
```

Values below 10 are rejected so the project always keeps the minimum test-data contract.

## Determinism and idempotency

Seed identifiers use `shared/ids.ts` instead of `randomUUID()` for fixture records. Natural/composite unique keys are used where the schema provides them; otherwise the stable fixture UUID is the upsert key. Dates use the fixed development reference date so repeated runs do not create time-dependent diffs.

The verification gate checks every model that is intentionally populated by the seed. The dataset expansion gate additionally verifies that every populated model reaches the configured minimum record count rather than silently leaving single-record fixtures behind.

## Seed policy

The goal is complete **safe bootstrap coverage**, not fabricated runtime security state. The seed populates static/reference data and representative business aggregates needed by the application, including users/RBAC, agents, properties, CRM, sales, matching, automation, CMS and system control-plane fixtures.

Security/session material is intentionally not manufactured: active login sessions, refresh/access tokens, password-reset tokens, two-factor challenges/recovery codes, webhook signing secrets, and transient import/export/queue state remain empty after reset unless an application flow explicitly creates them. External integration credentials are represented only by an environment reference (`env:ESTATEPRO_SEED_INTEGRATION_SECRET`); no secret value is stored in the database.

## Adding a new domain

Create `prisma/seeds/<domain>/`. Keep deterministic fixture definitions in `data.ts` and persistence logic in `seed.ts`. Only `runner.ts` coordinates cross-domain dependencies. Keep database/client construction in `database.ts` and environment-specific values in `config.ts`.

Do not bypass unique constraints, foreign keys, validation or security controls to make a seed pass. When a model is runtime-only or secret-bearing, document that policy explicitly instead of inserting fake production state.
