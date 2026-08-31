import type { PermissionSeed } from './data.ts';

export const CONTENT_PERMISSIONS: readonly PermissionSeed[] = [
  'articles','categories','tags','pages','faqs','testimonials','banners','menus','media','redirects','relations','comments'
].flatMap((resource) => ['read','create','update','delete','restore'].map((action) => ({ name: `${action} ${resource}`, code: `content.${resource}.${action}`, module: 'content', domain: resource, action })));

export const CONTENT_EXTRA_PERMISSIONS: readonly PermissionSeed[] = [
  { name: 'Publish Articles', code: 'content.articles.publish', module: 'content', domain: 'articles', action: 'publish' },
  { name: 'Archive Articles', code: 'content.articles.archive', module: 'content', domain: 'articles', action: 'archive' },
  { name: 'Interact With Articles', code: 'content.articles.interact', module: 'content', domain: 'articles', action: 'interact' },
  { name: 'Moderate Comments', code: 'content.comments.moderate', module: 'content', domain: 'comments', action: 'moderate' },
];
