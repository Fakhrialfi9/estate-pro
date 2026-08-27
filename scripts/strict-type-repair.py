from pathlib import Path
import re

ROOT = Path('.')


def replace_all(path: str, replacements: list[tuple[str, str]]) -> None:
    p = ROOT / path
    text = p.read_text()
    for old, new in replacements:
        text = text.replace(old, new)
    p.write_text(text)


def matching_brace(text: str, opening: int) -> int:
    depth = 0
    quote: str | None = None
    escaped = False
    for index in range(opening, len(text)):
        char = text[index]
        if quote is not None:
            if escaped:
                escaped = False
            elif char == '\\':
                escaped = True
            elif char == quote:
                quote = None
            continue
        if char in "'\"`":
            quote = char
        elif char == '{':
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0:
                return index
    raise RuntimeError('Unbalanced object literal')


def wrap_data_after(path: str, anchor: str) -> None:
    p = ROOT / path
    text = p.read_text()
    anchor_pos = text.find(anchor)
    if anchor_pos < 0:
        return
    data_pos = text.find('data: {', anchor_pos)
    if data_pos < 0:
        return
    opening = data_pos + len('data: ')
    closing = matching_brace(text, opening)
    text = text[:data_pos] + 'data: omitUndefined({' + text[data_pos + len('data: {'):]
    text = text[:closing + len('data: omitUndefined({') - len('data: {') + 1] + ')' + text[closing + len('data: omitUndefined({') - len('data: {') + 1:]
    p.write_text(text)


def ensure_import(path: str, statement: str) -> None:
    p = ROOT / path
    text = p.read_text()
    if statement not in text:
        p.write_text(statement + text)

# ---------------------------------------------------------------------------
# Domain / application contracts
# ---------------------------------------------------------------------------
replace_all('src/common/security/property-access.guard.ts', [('uuid: pathUuid,', 'uuid: propertyUuid,')])
replace_all('src/modules/property/application/property-details.service.ts', [
    ("actorType: 'user'", "actorType: 'AUTHENTICATED'"),
    ("result: 'success'", "result: 'SUCCESS'"),
])
patch = re.compile(r"changes:\n\s+typeof changes === 'object' && changes !== null\n\s+\? \(changes as Record<string, unknown>\)\n\s+: undefined,")
p = ROOT / 'src/modules/property/application/property-details.service.ts'
text = p.read_text()
text = patch.sub("""changes:
        typeof changes === 'object' && changes !== null
          ? Object.entries(changes as Record<string, unknown>).flatMap(
              ([field, value]) =>
                value === null ||
                typeof value === 'string' ||
                typeof value === 'boolean' ||
                (typeof value === 'number' && Number.isFinite(value))
                  ? [{ field, oldValue: null, newValue: value }]
                  : [],
            )
          : undefined,""", text, count=1)
p.write_text(text)

replace_all('src/modules/property/application/property-master.service.ts', [
    ("import type { SecurityAuditRepository } from '../../../common/audit/security-audit.port.js';", "import type { SecurityAuditChange, SecurityAuditRepository } from '../../../common/audit/security-audit.port.js';"),
    ('      slug: string;\n', '      slug?: string;\n'),
])

replace_all('src/modules/property/domain/property-extras.ts', [
    ("const [w, f = ''] = this.amount.split('.');", "const [w = '0', f = ''] = this.amount.split('.');"),
    ("const [w, f = ''] = v.split('.'),", "const [w = '0', f = ''] = v.split('.'),"),
    ("const [a, b] = o;", "const [a = 0, b = 0] = o;"),
])
replace_all('src/modules/property/listing/domain/listing.types.ts', [
    ("const [whole, fraction = ''] = normalized.split('.');", "const [whole = '0', fraction = ''] = normalized.split('.');"),
])

# ---------------------------------------------------------------------------
# Prisma details / extras: wrap patch-shaped data at the persistence boundary.
# ---------------------------------------------------------------------------
for path in (
    'src/modules/property/infrastructure/persistence/prisma-property-details.repository.ts',
    'src/modules/property/infrastructure/persistence/prisma-property-extras.repository.ts',
    'src/modules/property/listing/infrastructure/listing.repository.ts',
):
    ensure_import(path, "import { omitUndefined } from '../../../../common/omit-undefined.js';\n")

replace_all('src/modules/property/infrastructure/persistence/prisma-property-details.repository.ts', [
    (': current?.yearBuilt,', ': (current?.yearBuilt ?? null),'),
    (': current?.yearRenovated,', ': (current?.yearRenovated ?? null),'),
    ('data: common,', 'data: omitUndefined(common),'),
    ('data: scalar,', 'data: omitUndefined(scalar),'),
    ('facilityId: { in: facilityIds },', 'facilityId: { in: Array.from(facilityIds) },'),
    ('inputs[index].available', 'inputs[index]!.available'),
    ('inputs[index].quantity', 'inputs[index]!.quantity'),
    ('inputs[index].notes', 'inputs[index]!.notes'),
])
wrap_data_after('src/modules/property/infrastructure/persistence/prisma-property-details.repository.ts', 'return tx.propertyRoom.update({')
wrap_data_after('src/modules/property/infrastructure/persistence/prisma-property-details.repository.ts', 'return tx.propertyFacility.update({')

replace_all('src/modules/property/infrastructure/persistence/prisma-property-extras.repository.ts', [
    ('ownerReference: p.ownerReference,', 'ownerReference: p.ownerReference ?? null,'),
    ('ownerReferenceHash:\n                  owner === undefined || owner === null\n                    ? null\n                    : hashSensitive(owner),\n                ownerReferenceMasked:\n                  owner === undefined || owner === null\n                    ? null\n                    : maskSensitive(owner),\n                ...data,', '...omitUndefined(data),'),
    ('where: { id: c.id }, data })', 'where: { id: c.id }, data: omitUndefined(data) })'),
    ('where: { id: c.id },\n                  data,', 'where: { id: c.id },\n                  data: omitUndefined(data),'),
])
wrap_data_after('src/modules/property/infrastructure/persistence/prisma-property-extras.repository.ts', 'const r = await tx.propertyCertificate.create({')
wrap_data_after('src/modules/property/infrastructure/persistence/prisma-property-extras.repository.ts', 'const r = await tx.propertyCertificate.update({')
wrap_data_after('src/modules/property/infrastructure/persistence/prisma-property-extras.repository.ts', 'const r = await tx.propertyMedia.create({')
wrap_data_after('src/modules/property/infrastructure/persistence/prisma-property-extras.repository.ts', 'const r = await tx.propertyMedia.update({')

# ---------------------------------------------------------------------------
# Master store / presentation contracts.
# ---------------------------------------------------------------------------
p = ROOT / 'src/modules/property/infrastructure/persistence/prisma-property-master.store.ts'
text = p.read_text()
text = text.replace('  PageResult,\n', '')
if "import type { PageResult } from '../../domain/property-master.types.js';" not in text:
    text = text.replace(
        "import type {\n  MasterQuery,\n  PropertyMasterRepository,\n} from '../../domain/repositories/property-master.repository.js';\n",
        "import type {\n  MasterQuery,\n  PropertyMasterRepository,\n} from '../../domain/repositories/property-master.repository.js';\nimport type { PageResult } from '../../domain/property-master.types.js';\n",
        1,
    )
text = text.replace('const field = q.sortBy && allowed.includes(q.sortBy) ? q.sortBy : allowed[0];', "const field = q.sortBy && allowed.includes(q.sortBy) ? q.sortBy : (allowed[0] ?? 'uuid');")
p.write_text(text)

for filename in ('property-lifecycle.controller.ts', 'property-master.controller.ts'):
    p = ROOT / 'src/modules/property/presentation' / filename
    text = p.read_text()
    old = """const actor = (\n  r: AuthenticatedRequest,\n  userAgent?: string,\n  requestId?: string,\n) => ({ actorUuid: r.user?.sub, ipAddress: r.ip, userAgent, requestId });\n"""
    new = """const actor = (\n  r: AuthenticatedRequest,\n  userAgent?: string,\n  requestId?: string,\n) => {\n  const actorUuid = r.user?.sub;\n  if (!actorUuid) throw new ForbiddenException('Authenticated user is required');\n  return {\n    actorUuid,\n    ipAddress: r.ip ?? 'unknown',\n    ...(userAgent !== undefined ? { userAgent } : {}),\n    ...(requestId !== undefined ? { requestId } : {}),\n  };\n};\n"""
    if old in text:
        text = text.replace('  BadRequestException,\n', '  BadRequestException,\n  ForbiddenException,\n', 1)
        text = text.replace(old, new, 1)
    if filename == 'property-master.controller.ts':
        marker = 'type RecordValue = Record<string, unknown>;\n'
        if marker in text and 'const toRecord = ' not in text:
            text = text.replace(marker, marker + "const toRecord = (value: object): RecordValue => Object.fromEntries(Object.entries(value));\n", 1)
        for old_call, new_call in {
            'createCategory(d, actor(r, ua, rid))': 'createCategory({ ...d }, actor(r, ua, rid))',
            '.updateCategory(uuid, d.version, d, actor(r, ua, rid))': '.updateCategory(uuid, d.version, toRecord(d), actor(r, ua, rid))',
            'createSubcategory(d, actor(r, ua, rid))': 'createSubcategory({ ...d }, actor(r, ua, rid))',
            '.updateSubcategory(uuid, d.version, d, actor(r, ua, rid))': '.updateSubcategory(uuid, d.version, toRecord(d), actor(r, ua, rid))',
            '.createLocation(levelOf(level), d, actor(r, ua, rid))': '.createLocation(levelOf(level), toRecord(d), actor(r, ua, rid))',
            '.updateLocation(levelOf(level), uuid, d.version, d, actor(r, ua, rid))': '.updateLocation(levelOf(level), uuid, d.version, toRecord(d), actor(r, ua, rid))',
            'createFacility(d, actor(r, ua, rid))': 'createFacility({ ...d }, actor(r, ua, rid))',
            '.updateFacility(uuid, d.version, d, actor(r, ua, rid))': '.updateFacility(uuid, d.version, toRecord(d), actor(r, ua, rid))',
            'createProperty(d, actor(r, ua, rid))': 'createProperty(toRecord(d), actor(r, ua, rid))',
            '.updateProperty(uuid, d.version, d, actor(r, ua, rid))': '.updateProperty(uuid, d.version, toRecord(d), actor(r, ua, rid))',
        }.items():
            text = text.replace(old_call, new_call)
    p.write_text(text)

# ---------------------------------------------------------------------------
# Listing repository. run() already maps/throws persistence errors; the
# chained catches were widening T to T | Error and defeating that contract.
# ---------------------------------------------------------------------------
p = ROOT / 'src/modules/property/listing/infrastructure/listing.repository.ts'
text = p.read_text()
text = re.sub(r'\n\s*\.catch\(\(error: unknown\) => this\.mapError\(error\)\),', ',', text)
# Explicitly omit undefined at the three patch-heavy Prisma boundaries.
wrap_data_after('src/modules/property/listing/infrastructure/listing.repository.ts', 'const price = input.price')
wrap_data_after('src/modules/property/listing/infrastructure/listing.repository.ts', 'const price = input.price\n            ? await this.normalizePricing')
wrap_data_after('src/modules/property/listing/infrastructure/listing.repository.ts', 'const data: Prisma.PropertyListingUpdateManyMutationInput = {')
wrap_data_after('src/modules/property/listing/infrastructure/listing.repository.ts', 'return tx.propertyListing.create({')
# The first wrapper above may already have been applied to the duplicate create;
# conditional nested relations are handled directly below.
text = p.read_text()
text = text.replace(
"""              price: price
                ? {
                    create: {
                      uuid: randomUUID(),
                      ...price,
                      createdBy: actorId(actor),
                      updatedBy: actorId(actor),
                    },
                  }
                : undefined,""",
"""              ...(price
                ? {
                    price: {
                      create: {
                        uuid: randomUUID(),
                        ...price,
                        createdBy: actorId(actor),
                        updatedBy: actorId(actor),
                      },
                    },
                  }
                : {}),"""
)
text = text.replace(
"""            engagements: viewerUserUuid
              ? {
                  where: { userUuid: viewerUserUuid },
                  select: { isSaved: true, viewedAt: true },
                }
              : undefined,""",
"""            ...(viewerUserUuid
              ? {
                  engagements: {
                    where: { userUuid: viewerUserUuid },
                    select: { isSaved: true, viewedAt: true },
                  },
                }
              : {}),"""
)
for key, name in (('country','countryUuid'),('province','provinceUuid'),('city','cityUuid'),('district','districtUuid')):
    text = text.replace(
        f'          {key}: query.{name}\n            ? {{ is: {{ uuid: query.{name} }} }}\n            : undefined,',
        f'          ...(query.{name} ? {{ {key}: {{ is: {{ uuid: query.{name} }} }} }} : {{}}),',
    )
for field, mn, mx in (('landArea','minLandArea','maxLandArea'),('buildingArea','minBuildingArea','maxBuildingArea'),('bedrooms','minBedrooms','maxBedrooms'),('bathrooms','minBathrooms','maxBathrooms')):
    pattern = rf'{field}:\n\s+query\.{mn}[^\n]*\n\s+\? \{{ gte: query\.{mn}, lte: query\.{mx} \}}\n\s+: undefined,'
    repl = f"...(query.{mn} !== undefined || query.{mx} !== undefined ? {{ {field}: omitUndefined({{ ...(query.{mn} !== undefined ? {{ gte: query.{mn} }} : {{}}), ...(query.{mx} !== undefined ? {{ lte: query.{mx} }} : {{}}) }}) }} : {{}}),"
    text = re.sub(pattern, repl, text, count=1, flags=re.MULTILINE)
text = text.replace(
    'is: { maxPrice: { gte: query.minPrice, lte: query.maxPrice } },',
    'is: { maxPrice: omitUndefined({ ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}), ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}) }) },',
)
p.write_text(text)
