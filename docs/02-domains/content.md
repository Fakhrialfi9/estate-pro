# Estate Pro Content Management

The `ContentModule` is a bounded context for editorial and supporting content. Presentation depends on application use cases, application depends on domain ports, and Prisma is restricted to infrastructure persistence.

## Resource model

Core content includes articles and pages. Supporting content includes categories, tags, media, FAQs, testimonials, banners, menus, redirects, relations, revisions, comments and engagement counters.

All mutable content uses stable UUIDs externally. Database primary keys are internal numeric IDs. Slugs are normalized and unique; old article/page slugs are represented by permanent redirects when changed.

## Lifecycle

`DRAFT -> IN_REVIEW -> APPROVED -> SCHEDULED -> PUBLISHED -> ARCHIVED`

Rejection returns content to `DRAFT`/`IN_REVIEW`. Publishing, unpublishing, archiving and restoration are explicit application operations. Revisions are immutable snapshots and a restore creates a new revision rather than rewriting history.

## Persistence

Content schema lives under `prisma/schema/content`. Production schema changes use Prisma migrations. Transactions are used for article+tags+revision creation/update, menu reorder and other multi-write operations where atomicity is required.

## Security

HTML/rich text payloads are sanitized through an allowlist; dangerous URL schemes and event-handler attributes are rejected. DTO validation is whitelisted by the global validation pipe. Protected mutations require explicit permissions. Audit events use the repository's existing security/audit abstraction and do not include credentials or tokens.

Media uses a `StorageProvider` abstraction. The local implementation rejects traversal/path escape and stores generated keys rather than trusting arbitrary client paths. Upload metadata is persisted only after successful object storage, with cleanup on persistence failure.

## Public read model

Public article/page reads expose only published, public and non-deleted content. Responses are independently projected from the admin model and use ETag/HTTP cache semantics; private/admin responses must never be publicly cached.
