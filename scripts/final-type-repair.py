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
    prefix = text[:data_pos] + 'data: omitUndefined('
    middle = text[data_pos + len('data: '): closing + 1]
    suffix = text[closing + 1:]
    p.write_text(prefix + middle + ')' + suffix)


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


# Application service: slug is derived when omitted by the persistence layer.
for method in ('createCategory', 'createSubcategory', 'createFacility'):
    p = Path('src/modules/property/application/property-master.service.ts')
    text = p.read_text()
    start = text.find(f'  {method}(')
    if start >= 0:
        end = text.find('  }', start)
        if end >= 0:
            block = text[start:end]
            block = block.replace('slug: string;', 'slug?: string;')
            text = text[:start] + block + text[end:]
            p.write_text(text)

# Property details: patch-shaped updates must not pass undefined Prisma fields.
wrap_first_data_after(
    'src/modules/property/infrastructure/persistence/prisma-property-details.repository.ts',
    'return tx.propertyBuilding.update({',
)
wrap_first_data_after(
    'src/modules/property/infrastructure/persistence/prisma-property-details.repository.ts',
    'return tx.propertyRoom.update({',
)
wrap_first_data_after(
    'src/modules/property/infrastructure/persistence/prisma-property-details.repository.ts',
    'return tx.propertyFacility.update({',
)

# Utility / SEO / certificate / media create/update data objects.
for anchor in (
    'await tx.propertyUtility.create({',
    'await tx.propertySeo.create({',
    'await tx.propertyCertificate.create({',
    'await tx.propertyCertificate.update({',
    'await tx.propertyMedia.create({',
    'await tx.propertyMedia.update({',
):
    wrap_first_data_after('src/modules/property/infrastructure/persistence/prisma-property-extras.repository.ts', anchor)

# Master-store strict id and enum validation.
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

# Listing create/update: remove optional relation keys instead of assigning undefined.
p = Path('src/modules/property/listing/infrastructure/listing.repository.ts')
text = p.read_text()
wrap_first_data_after(p.as_posix(), 'this.prisma.propertyListing.create({')
text = p.read_text()
# Also wrap the duplicate create and transition update after the first transformation.
wrap_first_data_after(p.as_posix(), 'tx.propertyListing.create({')
text = p.read_text()
text = re.sub(r'\n\s*\.catch\(\(error: unknown\) => this\.mapError\(error\)\),', ',', text)
# Engagement selection and location relations are conditionally present.
text = text.replace(
"""        engagements: engagementUserUuid
          ? {
              where: { userUuid: engagementUserUuid },
              select: { isSaved: true, viewedAt: true },
            }
          : undefined,""",
"""        ...(engagementUserUuid
          ? {
              engagements: {
                where: { userUuid: engagementUserUuid },
                select: { isSaved: true, viewedAt: true },
              },
            }
          : {}),""",
)
for key, name in (('country','countryUuid'),('province','provinceUuid'),('city','cityUuid'),('district','districtUuid')):
    text = text.replace(
        f'          {key}: query.{name} ? {{ is: {{ uuid: query.{name} }} }} : undefined,',
        f'          ...({name} ? {{ {key}: {{ is: {{ uuid: {name} }} }} }} : {{}}),',
    )
p.write_text(text)

# Controller actor context: auth middleware guarantees user in protected routes;
# fail closed when it is absent and omit undefined metadata properties.
for filename in ('property-lifecycle.controller.ts', 'property-master.controller.ts'):
    p = Path('src/modules/property/presentation') / filename
    text = p.read_text()
    old = """const actor = (\n  request: AuthenticatedRequest,\n  userAgent?: string,\n  requestId?: string,\n) => ({\n  actorUuid: request.user?.sub,\n  ipAddress: request.ip,\n  userAgent,\n  requestId,\n});"""
    new = """const actor = (\n  request: AuthenticatedRequest,\n  userAgent?: string,\n  requestId?: string,\n) => {\n  const actorUuid = request.user?.sub;\n  if (!actorUuid) throw new ForbiddenException('Authenticated user is required');\n  return {\n    actorUuid,\n    ipAddress: request.ip ?? 'unknown',\n    ...(userAgent !== undefined ? { userAgent } : {}),\n    ...(requestId !== undefined ? { requestId } : {}),\n  };\n};"""
    if old in text:
        text = text.replace('  BadRequestException,\n', '  BadRequestException,\n  ForbiddenException,\n', 1)
        text = text.replace(old, new, 1)
    p.write_text(text)
