# Security baseline

## Rate limiting

The API has a global NestJS Throttler policy configured from `SECURITY_RATE_LIMIT_TTL` and `SECURITY_RATE_LIMIT_MAX`. Route-specific overrides can be added later with NestJS throttler metadata without changing the root configuration.

The built-in storage is process-local. This is intentional for the current single-instance foundation. A distributed deployment with multiple instances must move throttling state to a shared store before treating the limit as a cluster-wide guarantee.

## Trust proxy

`trust proxy` is disabled unless `SECURITY_TRUST_PROXY` is explicitly configured. `true` is rejected by environment validation because trusting every upstream address can make forwarded client identity spoofable.

A deployment must set an explicit IP/subnet or hop policy only after the real proxy topology is verified. Rate limiting and secure-cookie behavior depend on this decision.

## Headers

Helmet is enabled at the HTTP boundary. Frame protection, MIME sniffing protection, and a restrictive referrer policy are always enabled. CSP is enabled in production by default and can be explicitly enabled elsewhere. HSTS is opt-in and must only be enabled when the public origin is correctly served over HTTPS.

## Secrets

Production and staging reject short JWT secrets and known placeholder values. Secrets are environment inputs only and are never part of the repository source.

## Logging

Pino redaction is configured at the logger boundary. Request headers, cookies, credentials, password fields, tokens, API keys, secrets, private keys, and session identifiers are removed before log output. Application code must not rely on developers remembering to redact individual log calls.
