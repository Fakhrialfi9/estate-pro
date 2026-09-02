# Analytics Bounded Context

Estate Pro Analytics is a read-oriented bounded context. Transactional ownership remains with CRM, Sales, Property, Agent Management and Users.

## Source-of-truth inventory

| Dataset | Source | Primary analytics facts |
|---|---|---|
| Leads | CRM | createdAt, status, source, campaign, owner, qualifiedAt, closedAt, convertedAt, history |
| Lead attribution | CRM | source and campaign relations |
| Opportunities | Sales | pipeline, stage, owner, valueAmount, status, createdAt |
| Stage history | Sales | from/to stage, occurredAt |
| Deals | Sales | totalAmount, currency, status, owner |
| Closings | Sales | closedAt |
| Properties | Property | status, type, category, createdAt, publishedAt, verifiedAt, assignment |
| Listings | Property | transactionType, status, visibility, featured, premium |
| Agents | Agent Management | user identity, status, availability, targets |
| Activities | Sales/CRM | type, status, actor, timestamps |

## Canonical time contract

Database timestamps are treated as UTC. API `from` is inclusive and `to` is exclusive. Default range is the previous 30 days through request time. Maximum range is 366 days. Granularity is `day`, `week` or `month`, with ISO week numbering for weekly buckets.

## Scope model

`analytics.read` provides a scoped view. `analytics.read.all` and `analytics.manage` provide global reporting. Agent scope is applied inside the source query, before grouping or aggregation. Financial analytics additionally require `analytics.revenue.read` or a global analytics permission.

## Canonical metrics

- Lead volume: `COUNT(leads)`.
- Qualified rate: `qualified / leads * 100`.
- Lead conversion rate: `converted / leads * 100`.
- Expected revenue: `SUM(open opportunity value * stage probability / 100)`.
- Closed revenue: `SUM(deal total amount)` grouped by closing date and currency.
- Lead age: elapsed days from lead creation to report cutoff for open leads.
- Stage velocity: elapsed time between consecutive stage-history events.
- SLA breach: elapsed time greater than the declared threshold.

Revenue is never aggregated across currencies. Decimal-valued financial outputs are serialized as decimal strings.

## API

All endpoints are versioned with the application's existing `/api/v1` prefix and require JWT authentication plus analytics permissions.

- `GET /api/v1/analytics/leads`
- `GET /api/v1/analytics/acquisition`
- `GET /api/v1/analytics/conversion`
- `GET /api/v1/analytics/pipeline`
- `GET /api/v1/analytics/property-agent`
- `GET /api/v1/analytics/sales-revenue`
- `GET /api/v1/analytics/sla`
- `GET /api/v1/analytics/forecast`
- `GET /api/v1/analytics/export?report=...`

All report responses expose generation time, UTC range, granularity, page, limit and bounded result metadata.

## Forecast v1

The baseline is deterministic and explainable: probability-weighted open pipeline plus historical average deal value. Fewer than five historical closed deals produces `INSUFFICIENT_DATA` instead of false precision. No ML dependency or mutation is introduced.

## Performance policy

Analytics queries use set-based SQL aggregation and a 5,000-row internal bound. Client page size is limited to 100 and page number to 50. Heavy operations have a ten-second application timeout. Index additions must be justified by query plans and observed workload.

## Export policy

CSV export reuses report authorization and filters, is explicitly permissioned, and is bounded to 10,000 flattened rows. No raw credentials, secrets, audit payloads or wholesale personal data should be added to the export contract.

## Operations and security

Analytics must inherit global request IDs, logging, tracing and throttling. Query failures return sanitized API errors. Audit access should record actor/report/range metadata where policy requires it without storing the full report dataset.

## Release gates

Before release, reconcile critical KPIs against source-of-truth fixtures, execute unit/integration/E2E/security coverage, validate OpenAPI, run migration validation, benchmark critical queries, and verify Docker/runtime smoke tests. Materialization and caching remain optional decisions driven by evidence rather than defaults.
