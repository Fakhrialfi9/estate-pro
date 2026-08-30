# System Domain

The `system` context owns cross-cutting system capabilities that are not business-domain records.

## Current capabilities
- application bootstrap/configuration
- health/readiness/liveness
- request correlation
- secure validation
- security middleware and throttling
- observability integration
- persistence infrastructure

## Security responsibility
System infrastructure establishes secure defaults: strict configuration validation, Helmet, explicit CORS, bounded request bodies, request IDs, throttling, and safe logging. Authentication and authorization remain owned by their dedicated modules.

## Boundary
System code may provide shared infrastructure contracts, but business rules should remain in their bounded context.
