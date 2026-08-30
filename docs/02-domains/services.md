# Services Domain

`src/modules/services` is the bounded-context boundary for service-domain capabilities and is currently scaffolded.

## Responsibility
The services context should own service definitions, lifecycle/status rules, and service-specific business workflows. It should expose application-level contracts rather than leaking persistence details.

## Security
Authentication identifies the caller; authorization controls service capabilities. Sensitive service operations should use explicit permissions and object scope instead of trusting frontend state.

## Current state
Only architectural responsibility is documented until concrete service workflows and APIs are implemented.
