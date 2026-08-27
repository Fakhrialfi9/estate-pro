from pathlib import Path
import re


def replace(path: str, old: str, new: str, count: int = -1) -> None:
    p = Path(path)
    text = p.read_text()
    updated = text.replace(old, new, count)
    if updated != text:
        p.write_text(updated)


def wrap_data_property(path: str, anchor: str) -> None:
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
        raise RuntimeError(f'Unbalanced data object in {path}: {anchor}')
    p.write_text(
        text[:data_pos]
        + 'data: omitUndefined('
        + text[data_pos + len('data: '):closing + 1]
        + ')'
        + text[closing + 1:]
    )

# Application service must normalize the optional slug before calling the
# repository, whose contract still requires the final persisted slug.
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

# Lifecycle actor context.
p = Path('src/modules/property/presentation/property-lifecycle.controller.ts')
text = p.read_text()
if '  ForbiddenException,' not in text:
    text = text.replace('  Headers,\n', '  ForbiddenException,\n  Headers,\n', 1)
text = re.sub(
    r'const actor = \(\s*request: AuthenticatedRequest,\s*userAgent\?: string,\s*requestId\?: string,\s*\) => \(\{\s*actorUuid: request\.user\?\.sub,\s*ipAddress: request\.ip,\s*userAgent,\s*requestId,\s*\}\);',
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
    flags=re.MULTILINE,
)
p.write_text(text)

# Details persistence: update patch objects without explicit undefined.
for anchor in (
    'return tx.propertyRoom.update({',
    'return tx.propertyFacility.update({',
):
    wrap_data_property('src/modules/property/infrastructure/persistence/prisma-property-details.repository.ts', anchor)

# Extras persistence: undefined optional values must be omitted at Prisma boundaries.
for anchor in (
    'const r = await tx.propertyCertificate.create({',
    'const r = await tx.propertyCertificate.update({',
    'const r = await tx.propertySeo.create({',
    'const r = await tx.propertyMedia.create({',
    'const r = await tx.propertyMedia.update({',
):
    wrap_data_property('src/modules/property/infrastructure/persistence/prisma-property-extras.repository.ts', anchor)

# Master store enum/id contracts.
p = Path('src/modules/property/infrastructure/persistence/prisma-property-master.store.ts')
text = p.read_text()
text = text.replace(
    'return this.prisma.facility.update({ where: { id: current.id }, data });',
    "const id = current.id;\n      if (typeof id !== 'number' && typeof id !== 'bigint') throw new MasterNotFoundError('Facility id is invalid');\n      return this.prisma.facility.update({ where: { id }, data });",
    1,
)
text = text.replace(
    "availabilityStatus: text(input.availabilityStatus, 'AVAILABLE'),",
    "availabilityStatus: (() => {\n              const value = text(input.availabilityStatus, 'AVAILABLE');\n              if (value !== 'AVAILABLE' && value !== 'UNAVAILABLE')\n                throw new MasterHierarchyError('Invalid availability status');\n              return value;\n            })(),",
    1,
)
p.write_text(text)

# Listing repository: optional relations/filter branches and mutable payment arrays.
p = Path('src/modules/property/listing/infrastructure/listing.repository.ts')
text = p.read_text()
text = text.replace(
    'create: input.payments.map((payment) => ({',
    'create: Array.from(input.payments, (payment) => ({',
    1,
)
text = text.replace(
"""              paymentOptions: input.payments?.length
                ? {
                    create: Array.from(input.payments, (payment) => ({""",
"""              ...(input.payments?.length
                ? {
                    paymentOptions: {
                      create: Array.from(input.payments, (payment) => ({""",
    1,
)
text = text.replace(
"""                  }
                : undefined,
              analytics:""",
"""                    },
                  }
                : {}),
              analytics:""",
    1,
)
text = text.replace(
    'const data: Prisma.PropertyListingUpdateManyMutationInput = {',
    'const data: Prisma.PropertyListingUpdateManyMutationInput = omitUndefined({',
    1,
)
text = text.replace(
"""            version: { increment: 1 },
          };
          if (to === 'PUBLISHED')""",
"""            version: { increment: 1 },
          });
          if (to === 'PUBLISHED')""",
    1,
)
text = text.replace(
"""              paymentOptions: source.paymentOptions.length
                ? {
                    create: source.paymentOptions.map((payment) => ({""",
"""              ...(source.paymentOptions.length
                ? {
                    paymentOptions: {
                      create: Array.from(source.paymentOptions, (payment) => ({""",
    1,
)
text = text.replace(
"""                  }
                : undefined,
              analytics:""",
"""                    },
                  }
                : {}),
              analytics:""",
    1,
)
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
    1,
)
# Remove any error-mapping catch that widens successful return types to T | Error.
text = re.sub(r'\n\s*\.catch\(\(error: unknown\) => this\.mapError\(error\)\),', ',', text)
p.write_text(text)
