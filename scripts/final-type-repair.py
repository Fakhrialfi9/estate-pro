from pathlib import Path
import re


def replace(path: str, old: str, new: str, count: int | None = None) -> None:
    p = Path(path)
    text = p.read_text()
    text = text.replace(old, new) if count is None else text.replace(old, new, count)
    p.write_text(text)


def wrap_first_data_after(path: str, anchor: str) -> None:
    p = Path(path)
    text = p.read_text()
    anchor_pos = text.find(anchor)
    if anchor_pos < 0:
        return
    data_pos = text.find('data: {', anchor_pos)
    if data_pos < 0:
        return
    opening = data_pos + len('data: ')
    closing = matching_brace(text, opening)
    p.write_text(
        text[:data_pos]
        + 'data: omitUndefined('
        + text[data_pos + len('data: '):closing + 1]
        + ')'
        + text[closing + 1:]
    )


def matching_brace(text: str, opening: int) -> int:
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
                return i
    raise RuntimeError('unbalanced object literal')


# The application contract derives slugs from names when callers omit them.
p = Path('src/modules/property/application/property-master.service.ts')
text = p.read_text()
for method in ('createCategory', 'createSubcategory', 'createFacility'):
    pattern = rf'(async\s+{method}\(\s*input:\s*\{{.*?)(\bslug:) string;(.*?\n\s*\},\s*\n\s*actor: ActorContext)'
    text = re.sub(pattern, r'\1\2 string;\3', text, count=1, flags=re.MULTILINE | re.DOTALL)
    # The service methods are not async in some revisions; support both forms and preserve exact contract.
    start = text.find(f'  {method}(\n    input:')
    if start >= 0:
        end = text.find('\n  }', start)
        if end >= 0:
            block = text[start:end]
            block = block.replace('slug: string;', 'slug?: string;', 1)
            text = text[:start] + block + text[end:]
# Explicitly target the three known signatures if the generic pass left them unchanged.
for marker in (
    'typeUuid: string;\n      code: string;\n      name: string;\n      slug: string;',
    'categoryUuid: string;\n      code: string;\n      name: string;\n      slug: string;',
    'code: string;\n      name: string;\n      slug: string;\n      category: FacilityCategory;',
):
    text = text.replace(marker, marker.replace('slug: string;', 'slug?: string;'), 1)
p.write_text(text)

# Strict optional Prisma data objects.
for anchor in (
    'return tx.propertyBuilding.update({',
    'return tx.propertyRoom.update({',
    'return tx.propertyFacility.update({',
):
    wrap_first_data_after('src/modules/property/infrastructure/persistence/prisma-property-details.repository.ts', anchor)

for anchor in (
    'const r = await tx.propertyUtility.create({',
    'const r = await tx.propertyCertificate.create({',
    'const r = await tx.propertyCertificate.update({',
    'const r = await tx.propertySeo.create({',
    'const r = await tx.propertyMedia.create({',
    'const r = await tx.propertyMedia.update({',
):
    wrap_first_data_after('src/modules/property/infrastructure/persistence/prisma-property-extras.repository.ts', anchor)

# Master store: narrow unknown IDs and validate string enum values.
p = Path('src/modules/property/infrastructure/persistence/prisma-property-master.store.ts')
text = p.read_text()
text = text.replace(
    'return this.prisma.facility.update({ where: { id: current.id }, data });',
    "const id = current.id;\n      if (typeof id !== 'number' && typeof id !== 'bigint')\n        throw new MasterNotFoundError('Facility id is invalid');\n      return this.prisma.facility.update({ where: { id }, data });",
    1,
)
text = text.replace(
    "availabilityStatus: text(input.availabilityStatus, 'AVAILABLE'),",
    "availabilityStatus: (() => {\n              const value = text(input.availabilityStatus, 'AVAILABLE');\n              if (value !== 'AVAILABLE' && value !== 'UNAVAILABLE')\n                throw new MasterHierarchyError('Invalid availability status');\n              return value;\n            })(),",
    1,
)
p.write_text(text)

# Listing repository: no explicit undefined relation keys; no readonly arrays in Prisma create inputs.
p = Path('src/modules/property/listing/infrastructure/listing.repository.ts')
text = p.read_text()
text = text.replace(
    'paymentOptions: input.payments?.length\n                ? {\n                    create: input.payments.map((payment) => ({',
    '...(input.payments?.length\n                ? {\n                    paymentOptions: {\n                      create: Array.from(input.payments, (payment) => ({',
    1,
)
text = text.replace(
    '                  }\n                : undefined,\n              analytics:',
    '                    },\n                  }\n                : {}),\n              analytics:',
    1,
)
text = text.replace(
    'paymentOptions: source.paymentOptions.length\n                ? {\n                    create: source.paymentOptions.map((payment) => ({',
    '...(source.paymentOptions.length\n                ? {\n                    paymentOptions: {\n                      create: Array.from(source.paymentOptions, (payment) => ({',
    1,
)
text = text.replace(
    '                  }\n                : undefined,\n              analytics:',
    '                    },\n                  }\n                : {}),\n              analytics:',
    1,
)
text = re.sub(r'\n\s*\.catch\(\(error: unknown\) => this\.mapError\(error\)\),', ',', text)
# Typed update object: remove undefined properties at construction.
text = text.replace(
    'const data: Prisma.PropertyListingUpdateManyMutationInput = {',
    'const data: Prisma.PropertyListingUpdateManyMutationInput = omitUndefined({',
    1,
)
# Close the update data literal.
text = text.replace(
    '            version: { increment: 1 },\n          };\n          if (to === \'PUBLISHED\')',
    '            version: { increment: 1 },\n          });\n          if (to === \'PUBLISHED\')',
    1,
)
# Engagement selector must be conditionally included.
text = text.replace(
    '        engagements: engagementUserUuid\n          ? {\n              where: { userUuid: engagementUserUuid },\n              select: { isSaved: true, viewedAt: true },\n            }\n          : undefined,',
    '        ...(engagementUserUuid\n          ? {\n              engagements: {\n                where: { userUuid: engagementUserUuid },\n                select: { isSaved: true, viewedAt: true },\n              },\n            }\n          : {}),',
    1,
)
# Location relations: conditionally include every relation filter.
for key, name in (('country', 'countryUuid'), ('province', 'provinceUuid'), ('city', 'cityUuid'), ('district', 'districtUuid')):
    text = text.replace(
        f'          {key}: query.{name} ? {{ is: {{ uuid: query.{name} }} }} : undefined,',
        f'          ...({{ {key}: query.{name} ? {{ is: {{ uuid: query.{name} }} }} : undefined }}),',
    )
    # Also support multiline form.
    text = text.replace(
        f'          {key}: query.{name}\n            ? {{ is: {{ uuid: query.{name} }} }}\n            : undefined,',
        f'          ...({{ {key}: query.{name} ? {{ is: {{ uuid: query.{name} }} }} : undefined }}),',
    )
p.write_text(text)

# Both controllers construct an authenticated actor context, never an optional actorUuid.
for filename in ('property-lifecycle.controller.ts', 'property-master.controller.ts'):
    p = Path('src/modules/property/presentation') / filename
    text = p.read_text()
    pattern = re.compile(
        r'const actor = \(\s*request: AuthenticatedRequest,\s*userAgent\?: string,\s*requestId\?: string,\s*\) => \(\{\s*actorUuid: request\.user\?\.sub,\s*ipAddress: request\.ip,\s*userAgent,\s*requestId,\s*\}\);',
        re.MULTILINE,
    )
    replacement = """const actor = (\n  request: AuthenticatedRequest,\n  userAgent?: string,\n  requestId?: string,\n) => {\n  const actorUuid = request.user?.sub;\n  if (!actorUuid) throw new ForbiddenException('Authenticated user is required');\n  return {\n    actorUuid,\n    ipAddress: request.ip ?? 'unknown',\n    ...(userAgent !== undefined ? { userAgent } : {}),\n    ...(requestId !== undefined ? { requestId } : {}),\n  };\n};"""
    if pattern.search(text):
        text = pattern.sub(replacement, text, count=1)
        if 'ForbiddenException' not in text.split('\n', 15)[0:15].__str__():
            text = text.replace('  BadRequestException,\n', '  BadRequestException,\n  ForbiddenException,\n', 1)
        if "ForbiddenException }" in text:
            pass
    p.write_text(text)
