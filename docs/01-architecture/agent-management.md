# Agent Management Bounded Context

Agent Management owns agent-specific business metadata and orchestration: profile, specialization, coverage, availability, capacity policy, target configuration, performance read models, and assignment orchestration.

## Ownership boundaries

- Users owns identity, authentication credentials, sessions, and security state. Agent stores only `userUuid` as an identity reference.
- Property owns property assignment persistence and property authorization. Agent consumes `PROPERTY_AGENT_ASSIGNMENT_PORT` and never imports Property repositories.
- CRM owns lead business state and lead assignment persistence. Agent consumes `CRM_AGENT_WORKLOAD_PORT` for workload reads.
- Sales owns opportunity/deal state. Agent consumes `SALES_AGENT_WORKLOAD_PORT` for workload/performance reads.
- Audit and Authorization remain centralized infrastructure/cross-cutting capabilities.

## Assignment policy

A target agent is assignable only when the Users snapshot is active and not deleted/suspended, the agent profile is ACTIVE, effective availability is ACTIVE, and remaining calculated capacity is positive. Assignment mutations are delegated to Property's existing persistence owner inside a transaction with property-row locking.

## Availability

Availability uses an explicit finite state plus weekly schedule and date-specific exceptions. Time evaluation is timezone-aware and fails closed when timezone evaluation is invalid.

## Capacity

Capacity is a read-derived value: current Property assignments + CRM assigned leads + open Sales work. No mutable counter is created as a second source of truth.

## Targets and performance

Targets are agent-owned configuration records with explicit period boundaries. Performance reads authoritative workload sources and calculates target achievement without accepting client-provided actual values.
