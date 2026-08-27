from pathlib import Path
import re


def replace(path: str, old: str, new: str, count: int = -1) -> None:
    p = Path(path)
    text = p.read_text()
    updated = text.replace(old, new, count)
    if updated != text:
        p.write_text(updated)


def wrap_data_block(path: str, anchor: str) -> None:
    p = Path(path)
    text = p.read_text()
    start = text.find(anchor)
    if start < 0:
        return
    data_pos = text.find('data: {', start)
    if data_pos < 0:
        return
    # Idempotent guard.
    if text[max(0, data_pos - 32):data_pos].rstrip().endswith('omitUndefined('):
        return
    opening = data_pos + len('data: ')
    depth = 0
    quote = None
    escaped = False
    for i in range(opening, len(text)):
        c = text[i]
        if quote is not None:
            if escaped:
                escaped = False
            elif c == '\\':
                escaped = True
            elif c == quote:
                quote = None
            continue
        if c in "'\"`":
            quote = c
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                p.write_text(text[:data_pos] + 'data: omitUndefined(' + text[data_pos + len('data: '):i + 1] + ')' + text[i + 1:])
                return
    raise RuntimeError(f'Unbalanced data object: {path} {anchor}')

# Application service: make slug optional only at the DTO/application boundary,
# then normalize it before invoking the repository contract which requires it.
p = Path('src/modules/property/application/property-master.service.ts')
text = p.read_text()
for signature in (
    ('typeUuid: string;\n      code: string;\n      name: string;\n      slug: string;', 'typeUuid: string;\n      code: string;\n      name: string;\n      slug?: string;'),
    ('categoryUuid: string;\n      code: string;\n      name: string;\n      slug: string;', 'categoryUuid: string;\n      code: string;\n      name: string;\n      slug?: string;'),
    ('code: string;\n      name: string;\n      slug: string;\n      category: FacilityCategory;', 'code: string;\n      name: string;\n      slug?: string;\n      category: FacilityCategory;'),
):
    text = text.replace(signature[0], signature[1], 1)
text = text.replace(
    'return this.run(() => this.repository.createCategory(input, actor));',
    'return this.run(() => this.repository.createCategory({ ...input, slug: input.slug ?? input.name }, actor));',
    1,
)
text = text.replace(
    'return this.run(() => this.repository.createSubcategory(input, actor));',
    'return this.run(() => this.repository.createSubcategory({ ...input, slug: input.slug ?? input.name }, actor));',
    1,
)
text = text.replace(
    'return this.run(() => this.repository.createFacility(input, actor));',
    'return this.run(() => this.repository.createFacility({ ...input, slug: input.slug ?? input.name }, actor));',
    1,
)
p.write_text(text)

# Details persistence.
wrap_data_block('src/modules/property/infrastructure/persistence/prisma-property-details.repository.ts', 'return tx.propertyRoom.update({')
wrap_data_block('src/modules/property/infrastructure/persistence/prisma-property-details.repository.ts', 'return tx.propertyFacility.update({')

# Extras persistence.
for anchor in (
    'const r = await tx.propertyCertificate.create({',
    'const r = await tx.propertyCertificate.update({',
    'const r = await tx.propertySeo.create({',
    'const r = await tx.propertyMedia.create({',
    'const r = await tx.propertyMedia.update({',
):
    wrap_data_block('src/modules/property/infrastructure/persistence/prisma-property-extras.repository.ts', anchor)

# Master-store closed enum.
replace(
    'src/modules/property/infrastructure/persistence/prisma-property-master.store.ts',
    "availabilityStatus: text(input.availabilityStatus, 'AVAILABLE'),",
    "availabilityStatus: text(input.availabilityStatus, 'AVAILABLE') === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE',",
    1,
)

# Listing update-many object. Find the declaration and close the object at its
# matching brace, so every optional property is removed before Prisma sees it.
p = Path('src/modules/property/listing/infrastructure/listing.repository.ts')
text = p.read_text()
marker = 'const data: Prisma.PropertyListingUpdateManyMutationInput = '
start = text.find(marker)
if start >= 0 and not text.startswith('const data: Prisma.PropertyListingUpdateManyMutationInput = omitUndefined(', start):
    opening = text.find('{', start + len(marker))
    depth = 0
    quote = None
    escaped = False
    closing = -1
    for i in range(opening, len(text)):
        c = text[i]
        if quote is not None:
            if escaped:
                escaped = False
            elif c == '\\':
                escaped = True
            elif c == quote:
                quote = None
            continue
        if c in "'\"`":
            quote = c
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                closing = i
                break
    if closing >= 0:
        text = text[:start] + marker + 'omitUndefined(' + text[start + len(marker):closing + 1] + ')' + text[closing + 1:]
# Selector relation: optional engagement selection must be absent when no user UUID.
text = re.sub(
    r"(?ms)^\s*engagements: engagementUserUuid\s*\?\s*\{\s*where: \{ userUuid: engagementUserUuid \},\s*select: \{ isSaved: true, viewedAt: true \},\s*\}\s*: undefined,",
    """        ...(engagementUserUuid
          ? {
              engagements: {
                where: { userUuid: engagementUserUuid },
                select: { isSaved: true, viewedAt: true },
              },
            }
          : {}),""",
    text,
    count=1,
)
p.write_text(text)

# Controller auth context.
p = Path('src/modules/property/presentation/property-lifecycle.controller.ts')
text = p.read_text()
if 'ForbiddenException' not in text:
    text = text.replace('  Headers,\n', '  ForbiddenException,\n  Headers,\n', 1)
text = re.sub(
    r"const actor = \(\s*request: AuthenticatedRequest,\s*userAgent\?: string,\s*requestId\?: string,\s*\) => \(\{\s*actorUuid: request\.user\?\.sub,\s*ipAddress: request\.ip,\s*userAgent,\s*requestId,\s*\}\);",
    """const actor = (
  request: AuthenticatedRequest,
  userAgent?: string,
  requestId?: string,
) => {
  const actorUuid = request.user?.sub;
  if (!actorUuid) throw new ForbiddenException('Authenticated user is required');
  return {
    actorUuid,
    ipAddress: request.ip ?? 'unknown',
    ...(userAgent !== undefined ? { userAgent } : {}),
    ...(requestId !== undefined ? { requestId } : {}),
  };
};""",
    text,
    count=1,
)
p.write_text(text)
