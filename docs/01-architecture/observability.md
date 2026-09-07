# Observability Contract

Estate Pro exposes read-only, authenticated observability APIs under `/api/v1/observability`.
All observability endpoints require the `system.observability.read` permission and use the existing authentication/authorization guards.

## Metrics endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/observability/system-metrics` | HTTP, database, application and current queue health summary |
| `GET /api/v1/observability/job-metrics` | Job execution count, state, retry, failure and latency metrics |
| `GET /api/v1/observability/webhook-metrics` | Webhook attempts, state, retry, failure and latency metrics |
| `GET /api/v1/observability/integration-metrics` | Integration operation count, state, retry, failure and latency metrics |
| `GET /api/v1/observability/import-export-metrics` | Import/export execution metrics |
| `GET /api/v1/observability/error-tracking` | Aggregated integration and audit failures with redaction |
| `GET /api/v1/observability/audit-correlation` | Correlates request/activity/job/integration records |
| `GET /api/v1/observability/delivery-metrics` | Backward-compatible webhook delivery metrics endpoint |

## Query contract

`from` and `to` are ISO-8601 timestamps. The default range is the previous 24 hours and the maximum range is 90 days. `granularity` accepts `hour`, `day`, or `week`.
Invalid ranges are rejected server-side.

## Metric cardinality and privacy

Metric labels are deliberately bounded to method/status class or stable operation names. User UUIDs, provider payloads, credentials, tokens, cookies, authorization headers and raw secrets must not be emitted as metric labels.
Error-tracking responses redact common secret-bearing fields and cap returned message length.

## Correlation

The audit surface uses `request_id`. Operational activities also preserve `request_id`; integration operation metadata and automation execution context may contain `correlationId`. The correlation endpoint returns only a bounded result set with source, identifier, event count, failure count and timestamps.

## SSRF outbound policy

All application-managed outbound URL fetches must pass the shared SSRF policy in `src/common/security/outbound-url-policy.ts`.
The policy validates the URL scheme, blocks URL credentials, localhost, reserved/local hostnames, private/link-local/multicast/reserved IP ranges, and rejects hostnames that cannot be resolved safely. Redirect following is disabled at the HTTP call sites.

`SECURITY_SSRF_ALLOWED_HOSTS` can restrict outbound hostnames to an explicit allowlist. `SECURITY_SSRF_ALLOW_LOCALHOST_HTTP` is a development-only escape hatch and must remain `false` in production.
