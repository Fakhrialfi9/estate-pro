# Content Domain

`src/modules/content` is the bounded-context boundary for application content. It is currently scaffolded.

## Responsibility
Content should own publishable content, editorial lifecycle, and content-specific validation/authorization. It must not own authentication, global authorization policy, or property security state.

## Boundary
Controllers should call content application services. Persistence should remain behind repositories owned by the content context. Cross-context interactions should use explicit application contracts.

## Current state
No completed content workflow is claimed by this document where the module currently contains only its scaffold/boundary.
