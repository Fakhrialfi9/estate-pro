# Estate Pro — STEP 322–342 Transaction, Concurrency & Query Safety

This document records the implementation boundaries and validation rules for STEP 322–342.

## Transaction boundaries

| Step | Boundary / decision | Result |
| --- | --- | --- |
| 322 | Credential password mutation is transactional with credential state and active-session revocation. Reset-token consumption, credential update, and session revocation are also one transaction. | Atomic |
| 323 | User profile has an independent lifecycle from the core user identity. Profile persistence is deliberately independent unless a future business command requires both writes to commit together. | Atomic where required |
| 324 | Role-permission assignment/removal is persisted as one transactional relation operation. Duplicate relation creation is protected by the database unique constraint and mapped to a business error. | Atomic |
| 325 | User-role assignment now executes lookup + state transition inside one Prisma transaction and still relies on the composite uniqueness constraint as the final race-safety boundary. | Atomic / race-safe |
| 326 | 2FA verification, enablement, and recovery-code replacement are persisted by a dedicated transaction coordinator. A failure rolls back the complete enrollment state. | Atomic |
| 327 | Password change uses compare-and-swap against the password hash observed during verification. A concurrent change cannot overwrite another successful change. | Atomic / conflict-safe |
| 328 | Session revocation uses conditional `updateMany` against an active session. Repeated or concurrent revocation is idempotent and cannot resurrect a revoked session. | Consistent |
| 329 | Audit writes are transactional internally: the audit record and its change rows commit or roll back together. Business transaction and audit transaction are intentionally not coupled unless the business operation explicitly requires the audit event to be part of its atomic boundary. | Failure strategy documented |

## Concurrency controls

### Duplicate role assignment

The application-level existence check remains an early business validation, but it is not trusted for race-safety. The composite `(userId, roleId)` uniqueness constraint is the final integrity boundary and `P2002` is mapped to the existing business error.

### Concurrent password updates

The password write is conditional on the hash observed during password verification. Only the request that still owns that expected version can update the row. A stale request receives `ConcurrentPasswordChangeError` and the transaction rolls back.

### Concurrent session revoke

Revocation is a conditional update on `revokedAt: null` and the active expiry condition. Only the first writer changes the row; subsequent concurrent writers observe zero affected rows and do not revert the session state.

## Query / performance policy

- User pagination is performed in the database with bounded `take` (maximum 100).
- User sorting uses an application allowlist and a deterministic UUID secondary ordering.
- User search is parameterized through Prisma and bounded to 100 characters at the repository boundary.
- User, role, permission, and session access use indexed identifiers / database-level filtering rather than loading complete datasets into application memory.
- Session lists are paginated in the database and only the relation needed to return the owning user UUID is loaded.
- Authorization permission resolution loads active user-role assignments and their permission codes in one relation query, then deduplicates codes in memory. It does not perform one query per role or permission.
- Audit logs are paginated in the database, sorted by indexed `createdAt`, and changes are selected as bounded child rows.

## Audit indexes

`AuditLog` has indexes for actor user, subject user, action, entity type, entity id, resource id, result, request id, and creation time. The default audit listing sort is `createdAt DESC` so the indexed time column supports the primary access pattern.

## Security invariants

Query field names and sort direction are never accepted as arbitrary SQL fragments. DTO validation is supplemented by repository-boundary defaults and allowlists. Authorization remains deny-by-default; query optimizations do not introduce authorization cache staleness.
