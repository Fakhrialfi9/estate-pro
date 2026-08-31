# CRM identifier strategy

Public CRM API identifiers are UUID v4 values. Internal CRM persistence identifiers remain unsigned BigInt where the database convention uses them.

Cross-context User and Property references are UUID strings consumed through public contracts; CRM does not create foreign keys into those bounded contexts.

Controllers validate UUID route parameters before application execution. Response serialization removes internal persistence identifiers and sensitive fields such as passwords, tokens, and provider secrets.

Compound database constraint names must remain within MariaDB identifier limits. Explicit short names are used where generated Prisma identifiers would exceed that limit.
