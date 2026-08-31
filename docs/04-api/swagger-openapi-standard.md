# Swagger / OpenAPI Documentation Standard

Estate Pro treats the generated OpenAPI document as an API contract, while runtime controllers, DTO validation, serializers, guards, and exception handling remain authoritative.

## Rules

- API versioning (`/api/v1/...`) and the OpenAPI specification version are separate concepts.
- `info.version` comes from the application release metadata (`APP_VERSION` / package version).
- Request DTO schemas are generated from TypeScript types and `class-validator` constraints through the Nest Swagger CLI plugin.
- Response schemas must describe the serialized public response, never a Prisma model or internal persistence row.
- Sensitive request fields such as passwords, refresh tokens, challenge tokens, TOTP material, and recovery codes are request-only unless a security-sensitive endpoint intentionally returns generated material.
- Public endpoints explicitly use an empty operation-level security requirement; protected endpoints declare the `bearer` requirement.
- Role/permission requirements are derived from the controller authorization decorators and are described in the operation documentation.
- Only runtime-reachable public errors are documented. The normalized public error contract never exposes stack traces, SQL, secrets, internal class names, or filesystem paths.
- `204` responses never contain a JSON response body.
- Query enums and defaults are copied from actual DTO/service allowlists, not invented for documentation.
- Examples are synthetic and never contain real credentials, tokens, secrets, production identifiers, or infrastructure details.
- `persistAuthorization` remains disabled so Swagger UI does not retain bearer credentials in browser storage.
- Swagger exposure is controlled by `SWAGGER_ENABLED`. Production defaults to disabled unless explicitly enabled through configuration.

## Runtime contract gate

`npm run test:openapi` boots the real Nest application test module, requests `/docs-json`, and validates the generated document. The validator checks OpenAPI version/metadata, `/api/v1` versioning, unique operation IDs, success responses, response content, path parameters, JSON request bodies, security requirements, schema formats/constraints/defaults, local `$ref` integrity, and sensitive response schema exposure.

The CI workflow runs the OpenAPI contract gate after E2E tests. A documentation change is therefore a release-quality change: invalid OpenAPI, security drift, broken references, or incomplete response contracts fail CI.

Controller changes are not complete until the generated contract still matches runtime behavior and the relevant tests pass.
