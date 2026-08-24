# Response serialization policy

Responses must not expose credentials or internal security material.

When response DTOs/entities are introduced, use NestJS `ClassSerializerInterceptor` with `class-transformer` and model the public response explicitly. Sensitive properties such as `password`, `passwordHash`, access/refresh tokens, secrets, and private keys must be excluded from the response class rather than removed ad hoc in controllers.

A response object that contains a sensitive field must not be returned directly from a controller. The owning presentation DTO/entity is responsible for its public shape.

The serializer is a response-boundary concern. It must not be used to mutate domain entities or persistence models in place.

No custom serializer framework is introduced while the repository has no feature response DTOs. This avoids an abstraction with no consumer while preserving a clear security policy for the Auth and feature phases.
