from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'missing expected pattern in {path}: {old!r}')
    file.write_text(text.replace(old, new, count))


# content.service.ts
replace('src/modules/content/application/content.service.ts', '  PagedResult,\n', '')
replace('src/modules/content/application/content.service.ts', r'/[\u0000-\u001f]/.test(href)', 'hasControlCharacters(href)')
replace(
    'src/modules/content/application/content.service.ts',
    'const words = (value: unknown): number => {',
    "const hasControlCharacters = (value: string): boolean =>\n  [...value].some((character) => character.charCodeAt(0) < 32);\n\nconst words = (value: unknown): number => {",
)
replace(
    'src/modules/content/application/content.service.ts',
    "provider: String(metadata.provider ?? 'local'),",
    "provider:\n        typeof metadata.provider === 'string' ? metadata.provider : 'local',",
)

service = Path('src/modules/content/application/content.service.ts')
text = service.read_text()
if 'async transitionArticle(' not in text:
    text = text.replace(
        "  async archive(uuid: string, ctx: AuditContext) {\n    return this.transition(uuid, 'archive', ctx);\n  }",
        """  async archive(uuid: string, ctx: AuditContext) {
    return this.transition(uuid, 'archive', ctx);
  }

  async transitionArticle(
    uuid: string,
    action: 'publish' | 'unpublish' | 'archive',
    ctx: AuditContext,
  ) {
    return this.transition(uuid, action, ctx);
  }""",
        1,
    )
if 'interaction(\n    kind:' not in text:
    text = text.replace(
        """  toggle(
    kind: 'like' | 'bookmark',
    uuid: string,
    user: string,
    ctx: AuditContext,
  ) {
    return this.repository.toggleInteraction(kind, uuid, user, ctx);
  }""",
        """  toggle(
    kind: 'like' | 'bookmark',
    uuid: string,
    user: string,
    ctx: AuditContext,
  ) {
    return this.repository.toggleInteraction(kind, uuid, user, ctx);
  }

  interaction(
    kind: 'like' | 'bookmark',
    uuid: string,
    user: string,
    ctx: AuditContext,
  ) {
    return this.toggle(kind, uuid, user, ctx);
  }""",
        1,
    )
if 'commentCreate(' not in text:
    text = text.replace(
        """  comment(uuid: string, input: Record<string, unknown>, ctx: AuditContext) {
    return this.repository.createComment(
      uuid,
      {
        ...input,
        userUuid: ctx.actorUuid,
        content: sanitizeJson(input.content),
      },
      ctx,
    );
  }""",
        """  comment(uuid: string, input: Record<string, unknown>, ctx: AuditContext) {
    return this.repository.createComment(
      uuid,
      {
        ...input,
        userUuid: ctx.actorUuid,
        content: sanitizeJson(input.content),
      },
      ctx,
    );
  }

  commentCreate(
    uuid: string,
    input: Record<string, unknown>,
    ctx: AuditContext,
  ) {
    return this.comment(uuid, input, ctx);
  }""",
        1,
    )
if 'commentModerate(' not in text:
    text = text.replace(
        """  moderate(
    uuid: string,
    status: string,
    reason: string | undefined,
    ctx: AuditContext,
  ) {
    return this.repository.moderateComment(uuid, status, reason, ctx);
  }""",
        """  moderate(
    uuid: string,
    status: string,
    reason: string | undefined,
    ctx: AuditContext,
  ) {
    return this.repository.moderateComment(uuid, status, reason, ctx);
  }

  commentModerate(
    uuid: string,
    status: string,
    reason: string | undefined,
    ctx: AuditContext,
  ) {
    return this.moderate(uuid, status, reason, ctx);
  }""",
        1,
    )
service.write_text(text)

# Article repository
path = Path('src/modules/content/infrastructure/persistence/prisma-article.repository.ts')
text = path.read_text()
if 'private requiredString(value: unknown' not in text:
    text = text.replace(
        '  private enumStatus(value: unknown): ContentStatus {',
        """  private requiredString(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim())
      throw new ContentValidationError(`${field} is invalid`);
    return value.trim();
  }

  private enumStatus(value: unknown): ContentStatus {""",
        1,
    )
text = text.replace('String(input.title)', "this.requiredString(input.title, 'title')")
text = text.replace('String(input.slug)', "this.requiredString(input.slug, 'slug')")
text = text.replace('String(input.language)', "this.requiredString(input.language, 'language')")
path.write_text(text)

# Operations repository
path = Path('src/modules/content/infrastructure/persistence/prisma-content-operations.repository.ts')
text = path.read_text().replace("import { createHash } from 'node:crypto';\n", '')
text = text.replace("String(snapshot.contentFormat ?? 'RICH_TEXT')", "(typeof snapshot.contentFormat === 'string' ? snapshot.contentFormat : 'RICH_TEXT')")
text = text.replace("String(snapshot.visibility ?? 'PUBLIC')", "(typeof snapshot.visibility === 'string' ? snapshot.visibility : 'PUBLIC')")
path.write_text(text)

# Resource repository
path = Path('src/modules/content/infrastructure/persistence/prisma-content-resource.repository.ts')
text = path.read_text()
if 'ContentValidationError,' not in text:
    text = text.replace('  ContentNotFoundError,\n', '  ContentNotFoundError,\n  ContentValidationError,\n', 1)
if 'function requiredString(value: unknown' not in text:
    text = text.replace(
        'function jsonValue(value: unknown): Prisma.InputJsonValue {',
        """function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new ContentValidationError(`${field} is invalid`);
  return value.trim();
}

function optionalString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {""",
        1,
    )
text = text.replace("String(input.relationType ?? 'RELATED')", "requiredString(input.relationType ?? 'RELATED', 'relationType')")
text = text.replace('String(input.title)', "requiredString(input.title, 'title')")
text = text.replace('String(input.slug)', "requiredString(input.slug, 'slug')")
text = text.replace("String(input.template ?? 'default')", "optionalString(input.template, 'default')")
text = text.replace("String(input.contentFormat ?? 'RICH_TEXT')", "optionalString(input.contentFormat, 'RICH_TEXT')")
text = text.replace("String(input.visibility ?? 'PUBLIC')", "optionalString(input.visibility, 'PUBLIC')")
text = text.replace("String(input.placement ?? 'HOME_HERO')", "optionalString(input.placement, 'HOME_HERO')")
for field in ('status', 'visibility', 'contentFormat', 'placement', 'startAt', 'endAt'):
    text = text.replace(f'String(input.{field})', f"requiredString(input.{field}, '{field}')")
text = text.replace("String(item.label ?? '')", "optionalString(item.label, '')")
text = text.replace("String(item.itemType ?? 'url')", "optionalString(item.itemType, 'url')")
text = text.replace('String(relationType) as RelationType', "requiredString(relationType, 'relationType') as RelationType")
text = text.replace('relationType: relationType as RelationType', "relationType: requiredString(relationType, 'relationType') as RelationType")
text = text.replace('Promise<unknown | null>;', 'Promise<unknown>;')
path.write_text(text)

# Thin bridge repository: remove unused import and unused context parameters.
path = Path('src/modules/content/infrastructure/prisma-content.repository.ts')
text = path.read_text().replace('  ArticleRecord,\n', '')
text = text.replace('createMediaObject(input: Record<string, unknown>, ctx: AuditContext)', 'createMediaObject(input: Record<string, unknown>)')
text = text.replace('removeRelation(uuid: string, ctx: AuditContext)', 'removeRelation(uuid: string)')
text = text.replace('reorderMenu(uuid: string, items: string[], ctx: AuditContext)', 'reorderMenu(uuid: string, items: string[])')
text = text.replace('    ctx: AuditContext,\n  ) {\n    return this.operations.toggle(kind, articleUuid, userUuid);', '  ) {\n    return this.operations.toggle(kind, articleUuid, userUuid);', 1)
text = text.replace('    ctx: AuditContext,\n  ) {\n    return this.operations.moderate(uuid, status, reason);', '  ) {\n    return this.operations.moderate(uuid, status, reason);', 1)
text = text.replace('    ctx: AuditContext,\n  ) {\n    return this.operations.comment(articleUuid, input);', '  ) {\n    return this.operations.comment(articleUuid, input);', 1)
text = text.replace('    ctx: AuditContext,\n  ) {\n    return this.resources.ensureRedirect(type, oldSlug, newSlug);', '  ) {\n    return this.resources.ensureRedirect(type, oldSlug, newSlug);', 1)
path.write_text(text)

# Presentation lint hygiene.
path = Path('src/modules/content/presentation/content.controller.ts')
path.write_text(path.read_text().replace('  Headers,\n', ''))
path = Path('src/modules/content/presentation/supporting-content.controller.ts')
path.write_text(path.read_text().replace('  ApiResponse,\n', ''))

print('content lint repair source transform complete')
