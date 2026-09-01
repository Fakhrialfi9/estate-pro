# Property Matching Architecture

Property Matching is a dedicated bounded context under `src/modules/property-matching`. It owns preference state, deterministic matching decisions, score snapshots, recommendation snapshots/history and feedback.

## Source of truth

| Concern | Owner | Matching access |
|---|---|---|
| Property identity/lifecycle | Property | read-only projection |
| Listing state/visibility/transaction/pricing | Property Listing | read-only projection |
| Property specification/location | Property | read-only projection |
| Saved state | Property Listing Engagement | read-only adapter |
| View/inquiry aggregates | Property Listing Analytics | read-only signals |
| Contact/Lead | CRM | subject reference + ownership check |
| Authentication/session | Auth/Users | existing `JwtAuthGuard` |
| Authorization | Common security | existing `AuthorizationService` |
| Preference/score/recommendation/feedback | Property Matching | owned by Matching |

No Matching table has a foreign key into Property or CRM. Cross-context UUIDs are references, not aggregate ownership.

## Execution pipeline

`request -> subject authorization -> stored preference -> bounded candidate prefilter -> hard eligibility -> deterministic weighted score -> explanation -> stable ranking -> pagination/snapshot`

Hard criteria are evaluated before scoring. The candidate pool is capped at 500. The engine has no random ranking and uses score, publication timestamp, then listing UUID as tie-breakers.

## Visibility

Candidates must be an active property, available property, published listing, public listing, and not expired or soft-deleted. Recommendation reads re-check current visibility so a historical snapshot cannot re-expose an item that later became private, deleted, expired, unpublished or unavailable.

## Money semantics

Budget matching requires currency and price frequency compatibility. Matching does not silently compare monthly, annual, daily and total amounts as though they were equivalent.

## Location semantics

The existing country -> province -> city -> district -> subdistrict hierarchy is used first. Coordinates/radius are stored for future evidence-backed geographic matching, but no GIS dependency is introduced solely for matching.

## Persistence

Preference updates use optimistic version checks. Recommendation generation persists the snapshot, its items, current score snapshot and lineage/history in one transaction. Feedback is state-based and unique per recommendation item + subject.

## Freshness

A recommendation is stale when the preference version changes or an included source property/listing has been updated after generation. Current source visibility is always revalidated at read time.

## Operational posture

Metrics use aggregate labels only. Request duration and candidate-count telemetry are emitted through the existing OpenTelemetry API. No PII or candidate dumps are logged. No cache or worker is introduced until measured workload justifies it.
