# Domain Module Boundaries

The `src/modules` directory provides explicit boundaries for Estate Pro domains.

| Module | Responsibility |
|---|---|
| `property` | Property listings, property metadata, media, and property lifecycle. |
| `sales` | Sales pipeline, transactions, commissions, and sales workflow. |
| `services` | Property-related services and service fulfillment. |
| `content` | CMS content and publishing concerns. |
| `crm` | Leads, contacts, activities, and customer relationship workflows. |
| `users` | User identity and user-management concerns. |
| `system` | System-level administration and platform concerns. |

`auth`, `permissions`, and `roles` are cross-cutting security/identity modules and are kept separate from the seven business-domain boundaries above. They must not absorb domain business logic.

Each domain should expose its application-facing entry points explicitly and keep domain rules independent from infrastructure implementations.
