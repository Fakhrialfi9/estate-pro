# CMS Permission Matrix

Permissions are evaluated by the existing `AuthorizationGuard`/`AuthorizationService`. Content does not introduce a second authorization mechanism.

| Resource | Read | Create | Update | Delete | Restore | Publish/Moderate |
|---|---|---|---|---|---|---|
| Articles | `content.articles.read` | `content.articles.create` | `content.articles.update` | `content.articles.delete` | `content.articles.restore` | `content.articles.publish`, `content.articles.archive` |
| Categories | `content.categories.read` | `content.categories.create` | `content.categories.update` | `content.categories.delete` | `content.categories.restore` | — |
| Tags | `content.tags.read` | `content.tags.create` | `content.tags.update` | `content.tags.delete` | `content.tags.restore` | — |
| Pages | `content.pages.read` | `content.pages.create` | `content.pages.update` | `content.pages.delete` | `content.pages.restore` | Publish/Unpublish |
| Media | `content.media.read` | `content.media.create` | `content.media.update` | `content.media.delete` | `content.media.restore` | — |
| FAQs | `content.faqs.read` | `content.faqs.create` | `content.faqs.update` | `content.faqs.delete` | `content.faqs.restore` | — |
| Testimonials | `content.testimonials.read` | `content.testimonials.create` | `content.testimonials.update` | `content.testimonials.delete` | `content.testimonials.restore` | — |
| Banners | `content.banners.read` | `content.banners.create` | `content.banners.update` | `content.banners.delete` | `content.banners.restore` | Activate/deactivate |
| Menus | `content.menus.read` | `content.menus.create` | `content.menus.update` | `content.menus.delete` | `content.menus.restore` | Reorder |
| Redirects | `content.redirects.read` | `content.redirects.create` | `content.redirects.update` | `content.redirects.delete` | `content.redirects.restore` | — |
| Relations | `content.relations.read` | `content.relations.create` | `content.relations.update` | `content.relations.delete` | — | — |
| Comments | `content.comments.read` | `content.comments.create` | `content.comments.update` | `content.comments.delete` | `content.comments.restore` | `content.comments.moderate` |
| Engagement | `content.articles.interact` | — | — | — | — | — |

Public read endpoints are explicitly marked `@Public()` and never grant access to management mutations.

## CRM Permission Matrix

CRM reuses the same authorization stack. Private CRM controllers require JWT authentication and one explicit CRM permission. There is no second CRM-specific authorization framework.

| Resource | Read | Create | Update | Delete/Archive | Special |
|---|---|---|---|---|---|
| Contacts | `crm.contacts.read` | `crm.contacts.create` | `crm.contacts.update` | `crm.contacts.archive` | `crm.contacts.consent` |
| Leads | `crm.leads.read` | `crm.leads.create` | `crm.leads.update` | `crm.leads.archive` | `crm.leads.assign`, `crm.leads.merge` |
| CRM config | `crm.config.read` | `crm.config.manage` | `crm.config.manage` | `crm.config.manage` | source/campaign/type/status/tag |
| Scoring | `crm.scoring.read` | `crm.scoring.manage` | `crm.scoring.manage` | `crm.scoring.manage` | score recalculation uses `crm.leads.update` |
| Duplicate review | `crm.duplicates.read` | — | `crm.duplicates.manage` | — | merge requires `crm.leads.merge` |
| Inquiries | `crm.inquiries.read` | `crm.inquiries.create` | `crm.inquiries.update` | — | conversion requires `crm.inquiries.convert` |
| Activities | `crm.activities.read` | `crm.activities.create` | `crm.activities.update` | — | lifecycle transitions are explicit operations |
| Communications | `crm.communications.read` | `crm.communications.create` | `crm.communications.update` | — | templates use `crm.communications.manage` |

Assignment, merge, consent, conversion, lifecycle transitions, and score recalculation are explicit application operations; clients cannot simulate them by arbitrary PATCH fields. Public inquiry intake is isolated in `CrmPublicInquiryController` and does not inherit management permissions.
