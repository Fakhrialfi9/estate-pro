# Security policy

## CSRF decision

Estate Pro is an HTTP API and does not use browser cookie authentication as its authentication boundary in the current scope. CSRF middleware is therefore intentionally not enabled globally: enabling it without a cookie-authenticated state-changing flow would add policy and failure modes without protecting the current boundary.

When authentication introduces a browser cookie that carries authentication state, CSRF protection must be introduced at that boundary with a synchronizer-token or equivalent double-submit design, and state-changing routes must be covered explicitly.

## Request validation

The application bootstrap uses NestJS `ValidationPipe` with transformation, whitelisting, forbidden unknown properties, and forbidden unknown values. Request body size is centrally bounded by `SECURITY_BODY_LIMIT`.

## Proxy trust

`SECURITY_TRUST_PROXY` is opt-in and must identify the actual trusted proxy topology. The application rejects the unrestricted boolean `true`/`false` forms so client-supplied forwarding headers are not implicitly trusted.
