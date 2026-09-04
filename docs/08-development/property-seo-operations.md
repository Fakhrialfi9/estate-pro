# Property and SEO Operations Policy

## Distributed rate limiting

The application uses request throttling at the HTTP boundary and specialized limits for sensitive operations. The limiter must use a shared store when the deployment topology contains more than one application instance. A single-instance deployment may use the process-local limiter. Before enabling horizontal scaling, the production deployment MUST configure a shared rate-limit store and validate that counters are consistent across instances.

## Document retention

Property documents are metadata records with externally stored binaries. Document records are soft-deleted through `DELETED`, while versions remain linked for lineage until the configured retention period permits physical cleanup. Cleanup workers must delete the external object first or retry the object deletion safely when metadata cleanup cannot be atomically coordinated with external storage. Audit records must not be deleted as part of ordinary document cleanup.

## History retention

`PropertyHistory` is business history and is append-oriented. Retention or archival must preserve chronological ordering and must not mutate historical facts in place. Security audit logs remain governed by the audit retention policy and are independent of property business history.

## Sitemap generation

Sitemap generation is chunked at the data-access boundary. The application does not materialize the complete public-resource dataset before serialization. Eligibility remains derived from the resource publication/deletion/robots rules. Production monitoring should track row count, generation latency and memory usage before any additional caching is introduced.

## Cursor pagination decision

The current property history API uses bounded page/limit pagination with a maximum page size of 100 and a stable `(occurredAt, id)` ordering. Cursor pagination is not required until measured history volume or query latency demonstrates that offset pagination is a bottleneck. If that threshold is reached, a backward-compatible cursor contract should be introduced rather than replacing the existing contract abruptly.
