# API Contracts

## Global API policy
Base path: `/api/v1`. Request bodies are validated through the global `SecureValidationPipe` with transformation, whitelist, forbidden non-whitelisted fields, forbidden unknown values, and no implicit primitive conversion. Helmet, explicit CORS, request IDs, throttling, and bounded JSON/urlencoded body sizes are configured at bootstrap.

## Authentication
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/login` | public | username/email + password; may return MFA challenge |
| POST | `/auth/2fa/verify` | public challenge | complete MFA and issue session tokens |
| POST | `/auth/refresh` | public | rotate opaque refresh token |
| POST | `/auth/logout` | bearer + active session | revoke current session/family |
| GET | `/auth/me` | bearer + active session | return safe authenticated user view |

Successful non-MFA login returns an access token and refresh token. Access tokens are JWT bearer credentials with `sub` and `sid`. Refresh tokens are opaque base64url values.

## Authorization
Administrative/resource endpoints require authentication and explicit permission decorators/guards. Property endpoints additionally apply object-level property authorization; resource UUIDs alone do not grant access.

## Validation and errors
Invalid/malformed authentication input returns a generic authentication failure. Validation failures are rejected at the HTTP boundary. Protected resource access is denied with 401 when the principal/session is invalid and 403 when authentication succeeds but authorization fails.

## Security response rules
Refresh and 2FA responses use `Cache-Control: no-store`. Raw refresh tokens, passwords, MFA secrets, and other credentials are not included in logs/audit payloads or database fields intended for identifiers.

## Property API surface
The implemented property controllers cover property master data, details, facilities/extras, lifecycle, listing, and type operations. Each endpoint uses the DTOs and permission decorators present in the corresponding controller; object-level authorization remains mandatory for property resources.
