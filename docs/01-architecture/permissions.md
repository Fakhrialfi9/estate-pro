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
