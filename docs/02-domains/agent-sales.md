# Agent & Sales Domain

The repository defines `sales` as a future bounded context and `property` as the current resource domain. Agent/property authorization is already modeled through active `propertyAgentAssignment` records and object-level access policy.

## Agent model
An agent is an authenticated user represented by `agentUserUuid` in property-agent assignments. The assignment can carry display name and primary status plus audit ownership metadata.

## Sales responsibility
Sales is the intended home for lead/opportunity/deal workflows, commission rules, and sales lifecycle behavior. No completed sales workflow is claimed where the `sales` module remains scaffolded.

## Authorization boundary
Reading or mutating a property is not granted merely by possessing a generic CRUD permission. The property authorization layer also evaluates resource scope, including ownership and active agent assignment. Administrative permissions are distinct from object-level access.
