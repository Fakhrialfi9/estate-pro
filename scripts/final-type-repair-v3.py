from pathlib import Path
import re


def wrap_data_after(path: str, anchor: str) -> None:
    p = Path(path)
    text = p.read_text()
    anchor_pos = text.find(anchor)
    if anchor_pos < 0:
        return
    data_pos = text.find('data: {', anchor_pos)
    if data_pos < 0:
        return
    opening = data_pos + len('data: ')
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
    if closing < 0:
        raise RuntimeError(f'Unbalanced data object for {anchor}')
    p.write_text(text[:data_pos] + 'data: omitUndefined(' + text[data_pos + len('data: '):closing + 1] + ')' + text[closing + 1:])

# The repository requires a final slug; derive it in the application service.
p = Path('src/modules/property/application/property-master.service.ts')
text = p.read_text()
text = text.replace(
    'return this.run(() => this.repository.createCategory(input, actor));',
    "return this.run(() => this.repository.createCategory({ ...input, slug: input.slug ?? input.name }, actor));",
    1,
)
text = text.replace(
    'return this.run(() => this.repository.createSubcategory(input, actor));',
    "return this.run(() => this.repository.createSubcategory({ ...input, slug: input.slug ?? input.name }, actor));",
    1,
)
text = text.replace(
    'return this.run(() => this.repository.createFacility(input, actor));',
    "return this.run(() => this.repository.createFacility({ ...input, slug: input.slug ?? input.name }, actor));",
    1,
)
p.write_text(text)

# Strict Prisma update/create boundaries.
path = 'src/modules/property/infrastructure/persistence/prisma-property-details.repository.ts'
for anchor in ('return tx.propertyRoom.update({', 'return tx.propertyFacility.update({'):
    wrap_data_after(path, anchor)

path = 'src/modules/property/infrastructure/persistence/prisma-property-extras.repository.ts'
for anchor in (
    'const r = await tx.propertyCertificate.create({',
    'const r = await tx.propertyCertificate.update({',
    'const r = await tx.propertySeo.create({',
    'const r = await tx.propertyMedia.create({',
    'const r = await tx.propertyMedia.update({',
):
    wrap_data_after(path, anchor)

# Master status is a closed enum, not arbitrary user text.
p = Path('src/modules/property/infrastructure/persistence/prisma-property-master.store.ts')
text = p.read_text()
text = text.replace(
    "availabilityStatus: text(input.availabilityStatus, 'AVAILABLE'),",
    "availabilityStatus: text(input.availabilityStatus, 'AVAILABLE') === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE',",
    1,
)
p.write_text(text)

# Listing update-many: explicit undefined fields violate exactOptionalPropertyTypes.
p = Path('src/modules/property/listing/infrastructure/listing.repository.ts')
text = p.read_text()
text = text.replace(
    'const data: Prisma.PropertyListingUpdateManyMutationInput = {',
    'const data: Prisma.PropertyListingUpdateManyMutationInput = omitUndefined({',
    1,
)
text = text.replace(
    "            version: { increment: 1 },\n          };\n          if (to === 'PUBLISHED')",
    "            version: { increment: 1 },\n          });\n          if (to === 'PUBLISHED')",
    1,
)
# Selector relation is optional; don't put undefined into Prisma's select type.
text = re.sub(
    r"\n\s*engagements: engagementUserUuid\n\s*\? \{\n\s*where: \{ userUuid: engagementUserUuid \},\n\s*select: \{ isSaved: true, viewedAt: true \},\n\s*\}\n\s*: undefined,",
    """\n        ...(engagementUserUuid
          ? {
              engagements: {
                where: { userUuid: engagementUserUuid },
                select: { isSaved: true, viewedAt: true },
              },
            }
          : {}),""",
    text,
    count=1,
    flags=re.MULTILINE,
)
p.write_text(text)
