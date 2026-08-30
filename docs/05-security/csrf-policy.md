# CSRF Policy

Estate Pro uses an explicit bearer/JSON credential transport for authentication and refresh. The refresh token is submitted in the request body to `POST /api/v1/auth/refresh`; the server does not read a refresh credential from a browser cookie. Therefore the browser does not automatically attach the refresh credential to a cross-site request.

## Current controls
- Refresh token is not stored in an authentication cookie.
- CORS origins are explicit and configuration driven.
- Refresh responses use `Cache-Control: no-store`.
- The refresh endpoint does not issue an authentication cookie.
- HTTPS is required at the production transport boundary.

CORS is defense-in-depth, not the primary CSRF mechanism for the current non-ambient refresh credential.

## Revisit condition
If authentication or refresh changes to cookie-based transport, implement CSRF protection before release. The decision must include SameSite/Secure cookie attributes, trusted-origin validation, state-changing method policy, and a CSRF token mechanism appropriate to the browser architecture.

## Test evidence
The dynamic security suite verifies the refresh response does not establish cookie-based authentication and remains non-cacheable. Existing E2E refresh tests validate real HTTP rotation, replay rejection, logout invalidation, account-state enforcement, and concurrent refresh behavior.
