# Swagger / OpenAPI Documentation Standard

Estate Pro treats the generated OpenAPI document as a public API contract, while runtime controllers, DTO validation, serializers, guards, and exception handling remain authoritative.

## Rules

- API versioning (`/api/v1/...`) and the OpenAPI specification version are separate concepts.
- `info.version` comes from the application release metadata (`APP_VERSION` / package version).
- DTO request schemas are generated from TypeScript types and `class-validator` constraints through the Nest Swagger CLI plugin.
- Response schemas must describe the serialized public response, never a Prisma model or internal persistence row.
- Sensitive request fields such as passwords, refresh tokens, challenge tokens, TOTP material, and recovery codes must never be documented as response fields.
- Public endpoints must explicitly have an empty OpenAPI security requirement when a controller-level bearer decorator would otherwise inherit security.
- Protected endpoints must declare the `bearer` security requirement and describe meaningful privilege requirements where applicable.
- Only errors that can be produced by the runtime mapping are documented. In particular, Estate Pro currently uses 400, 401, 403, 404, 409, 429, 500 and 503 in the audited API areas; 422 is not advertised unless runtime behavior introduces it.
- `204` responses must not contain a JSON response body.
- Query parameter enums and defaults must be copied from actual DTO/service allowlists, not hand-invented.
- Examples are synthetic and must never contain real credentials, tokens, secrets, or production identifiers.
- `persistAuthorization` remains disabled so Swagger UI does not retain bearer credentials in browser storage.

## Validation

Every production build should expose `/docs-json`. The runtime OpenAPI validation script checks JSON validity, API versioned paths, operation IDs, response presence, local `$ref` integrity, bearer scheme configuration, and sensitive-field exposure.

Controller changes are not complete until the generated contract still matches runtime behavior and the relevant tests pass.
