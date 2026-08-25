# Role-Permission Authorization Cache Strategy

The current Estate Pro authorization path does not introduce a dedicated role-permission cache. Role-permission reads therefore use the authoritative database state.

If a cache is introduced later, the rules are:

- Key by stable role UUID and keep the permission identifier set deterministic.
- A successful assignment or removal must invalidate or atomically update the role permission entry before the mutation is exposed to authorization consumers.
- A cache hit may only grant permissions represented by the current authoritative state.
- Cache failures must never become an authorization bypass. The implementation must either fail closed or fall back to the authoritative database.
- Stale cache data must not be allowed to expand a principal's privilege set.
- The database composite primary key remains the final duplicate-assignment protection.
