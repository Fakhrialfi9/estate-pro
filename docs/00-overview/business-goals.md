# Business Goals

## Business outcomes
1. Provide a secure foundation for property agents and sales operations.
2. Keep property data and user actions behind explicit backend authorization boundaries.
3. Support long-lived authenticated sessions without long-lived bearer access tokens.
4. Produce auditable security events without persisting or logging authentication secrets.

## System goals
- Short-lived JWT access tokens (15 minutes by default).
- Rotated opaque refresh tokens with a 30-day default lifetime and an absolute server-side session lifetime.
- Role/permission authorization with deny-by-default behavior.
- Object-level property authorization for owners and authorized agents.
- MFA/TOTP and recovery-code protections.
- Deterministic security regression tests.

## Operational goals
- Reproducible Prisma migrations and seeds.
- Fast static security gate plus behavioral HTTP security tests.
- CI validation for dependency audit, formatting, linting, type checking, architecture, tests, coverage, build, runtime, Docker, and repository cleanliness.
