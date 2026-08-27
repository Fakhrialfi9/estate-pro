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
    closing += len('data: omitUndefined({') - len('data: {')
    text = text[:closing + 1] + ')' + text[closing + 1:]
    p.write_text(text)


def ensure_import(path: str, statement: str) -> None:
    p = ROOT / path
    text = p.read_text()
    if statement not in text:
        p.write_text(statement + text)

# Common helper used only at persistence boundaries.
helper = ROOT / 'src/common/omit-undefined.ts'
helper.parent.mkdir(parents=True, exist_ok=True)
helper.write_text('''type DeepDefined<T> = T extends Date
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepDefined<U>[]
    : T extends object
      ? { [K in keyof T]-?: DeepDefined<Exclude<T[K], undefined>> }
      : Exclude<T, undefined>;

const clean = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(clean);
  if (value instanceof Date) return value;
  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(input)) {
      const item = input[key];
      if (item !== undefined) output[key] = clean(item);
    }
    return output;
  }
  return value;
};

export const omitUndefined = <T extends object>(input: T): DeepDefined<T> =>
  clean(input) as DeepDefined<T>;
''')

# ---------------------------------------------------------------------------
# Domain / application contracts.
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

# Security audit change type + optional derived slug inputs.
replace_all('src/modules/property/application/property-master.service.ts', [
    ("import type { SecurityAuditRepository } from '../../../common/audit/security-audit.port.js';", "import type { SecurityAuditChange, SecurityAuditRepository } from '../../../common/audit/security-audit.port.js';"),
    ('      slug: string;\n', '      slug?: string;\n'),
])

# Strict indexed access in domain helpers.
replace_all('src/modules/property/domain/property-extras.ts', [
    ("const [w, f = ''] = this.amount.split('.');", "const [w = '0', f = ''] = this.amount.split('.');"),
    ("const [w, f = ''] = v.split('.'),", "const [w = '0', f = ''] = v.split('.'),"),
    ("const [a, b] = o;", "const [a = 0, b = 0] = o;"),
])
replace_all('src/modules/property/listing/domain/listing.types.ts', [
    ("const [whole, fraction = ''] = normalized.split('.');", "const [whole = '0', fraction = ''] = normalized.split('.');"),
])

# ---------------------------------------------------------------------------
# Prisma persistence boundaries.
# ---------------------------------------------------------------------------
for path in (
    'src/modules/property/infrastructure/persistence/prisma-property-details.repository.ts',
    'src/modules/property/infrastructure/persistence/prisma-property-extras.repository.ts',
    'src/modules/property/listing/infrastructure/listing.repository.ts',
):
    ensure_import(path, "import { omitUndefined } from '../../../../common/omit-undefined.js';\n")

p = ROOT / 'src/modules/property/infrastructure/persistence/prisma-property-details.repository.ts'
text = p.read_text()
text = text.replace(': current?.yearBuilt,', ': (current?.yearBuilt ?? null),').replace(': current?.yearRenovated,', ': (current?.yearRenovated ?? null),')
text = text.replace('data: common,', 'data: omitUndefined(common),').replace('data: scalar,', 'data: omitUndefined(scalar),')
text = text.replace('facilityId: { in: facilityIds },', 'facilityId: { in: Array.from(facilityIds) },')
text = text.replace('inputs[index].available', 'inputs[index]!.available').replace('inputs[index].quantity', 'inputs[index]!.quantity').replace('inputs[index].notes', 'inputs[index]!.notes')
text = text.replace('            data,\n          });', '            data: omitUndefined(data),\n          });')
wrap_data_after(str(p), 'return tx.propertyBuilding.update({')
p.write_text(text)

p = ROOT / 'src/modules/property/infrastructure/persistence/prisma-property-extras.repository.ts'
text = p.read_text()
text = text.replace('ownerReference: p.ownerReference,', 'ownerReference: p.ownerReference ?? null,')
text = text.replace('ownerReferenceHash:\n                  owner === undefined || owner === null\n                    ? null\n                    : hashSensitive(owner),\n                ownerReferenceMasked:\n                  owner === undefined || owner === null\n                    ? null\n                    : maskSensitive(owner),\n                ...data,', '...omitUndefined(data),')
text = text.replace('where: { id: c.id }, data })', 'where: { id: c.id }, data: omitUndefined(data) })')
text = text.replace('where: { id: c.id },\n                  data,', 'where: { id: c.id },\n                  data: omitUndefined(data),')
# Utility and SEO create data inherit optional patch fields; clean before the Prisma boundary.
text = text.replace(
    '              data: {\n                uuid: randomUUID(),\n                propertyId: id,\n                createdBy: sid(a),\n                ...data,\n              },',
    '              data: omitUndefined({\n                uuid: randomUUID(),\n                propertyId: id,\n                createdBy: sid(a),\n                ...data,\n              }),',
)
p.write_text(text)

# ---------------------------------------------------------------------------
# Property master persistence contracts.
# ---------------------------------------------------------------------------
p = ROOT / 'src/modules/property/infrastructure/persistence/prisma-property-master.store.ts'
text = p.read_text()
text = text.replace('  PageResult,\n', '')
if "import type { PageResult } from '../../domain/property-master.types.js';" not in text:
    marker = "import type {\n  MasterQuery,\n  PropertyMasterRepository,\n} from '../../domain/repositories/property-master.repository.js';\n"
    if marker in text:
        text = text.replace(marker, marker + "import type { PageResult } from '../../domain/property-master.types.js';\n", 1)
text = text.replace('const field = q.sortBy && allowed.includes(q.sortBy) ? q.sortBy : allowed[0];', "const field = q.sortBy && allowed.includes(q.sortBy) ? q.sortBy : (allowed[0] ?? 'uuid');")
text = text.replace(
    'return this.prisma.facility.update({ where: { id: current.id }, data });',
    "const id = current.id;\n      if (typeof id !== 'number' && typeof id !== 'bigint') throw new MasterNotFoundError('Facility id is invalid');\n      return this.prisma.facility.update({ where: { id }, data });",
)
p.write_text(text)

# ---------------------------------------------------------------------------
# Presentation layer.
# ---------------------------------------------------------------------------
for filename in ('property-lifecycle.controller.ts', 'property-master.controller.ts'):
    p = ROOT / 'src/modules/property/presentation' / filename
    text = p.read_text()
    old = """const actor = (\n  r: AuthenticatedRequest,\n  userAgent?: string,\n  requestId?: string,\n) => ({ actorUuid: r.user?.sub, ipAddress: r.ip, userAgent, requestId });\n"""
    new = """const actor = (\n  r: AuthenticatedRequest,\n  userAgent?: string,\n  requestId?: string,\n) => {\n  const actorUuid = r.user?.sub;\n  if (!actorUuid) throw new ForbiddenException('Authenticated user is required');\n  return {\n    actorUuid,\n    ipAddress: r.ip ?? 'unknown',\n    ...(userAgent !== undefined ? { userAgent } : {}),\n    ...(requestId !== undefined ? { requestId } : {}),\n  };\n};\n"""
    if old in text:
        text = text.replace('  BadRequestException,\n', '  BadRequestException,\n  ForbiddenException,\n', 1).replace(old, new, 1)
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
# Listing repository. Use conditional spreads for optional relations and
# construct numeric filters only with defined bounds.
# ---------------------------------------------------------------------------
p = ROOT / 'src/modules/property/listing/infrastructure/listing.repository.ts'
text = p.read_text()
# Redundant catches turn T into T | Error although run() already throws mapped errors.
text = re.sub(r'\n\s*\.catch\(\(error: unknown\) => this\.mapError\(error\)\),', ',', text)
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
"""              price: source.price
                ? {
                    create: {""",
"""              ...(source.price
                ? {
                    price: {
                      create: {""", 1)
text = text.replace('                  }\n                : undefined,\n              paymentOptions:', '                    },\n                  }\n                : {}),\n              paymentOptions:', 1)
# Transition data explicitly contains undefined optional timestamps.
text = text.replace('          const data: Prisma.PropertyListingUpdateManyMutationInput = {', '          const data: Prisma.PropertyListingUpdateManyMutationInput = omitUndefined({', 1)
text = text.replace('            version: { increment: 1 },\n          };\n          if (to === \'PUBLISHED\')', '            version: { increment: 1 },\n          });\n          if (to === \'PUBLISHED\')', 1)
# Search relation filters.
text = text.replace(
"""          country: query.countryUuid
            ? { is: { uuid: query.countryUuid } }
            : undefined,""",
"""          ...(query.countryUuid
            ? { country: { is: { uuid: query.countryUuid } } }
            : {}),"""
)
text = text.replace(
"""          province: query.provinceUuid
            ? { is: { uuid: query.provinceUuid } }
            : undefined,""",
"""          ...(query.provinceUuid
            ? { province: { is: { uuid: query.provinceUuid } } }
            : {}),"""
)
text = text.replace(
"""          city: query.cityUuid ? { is: { uuid: query.cityUuid } } : undefined,""",
"""          ...(query.cityUuid
            ? { city: { is: { uuid: query.cityUuid } } }
            : {}),"""
)
text = text.replace(
"""          district: query.districtUuid
            ? { is: { uuid: query.districtUuid } }
            : undefined,""",
"""          ...(query.districtUuid
            ? { district: { is: { uuid: query.districtUuid } } }
            : {}),"""
)
for field, mn, mx in (('landArea','minLandArea','maxLandArea'),('buildingArea','minBuildingArea','maxBuildingArea'),('bedrooms','minBedrooms','maxBedrooms'),('bathrooms','minBathrooms','maxBathrooms')):
    pattern = rf'{field}:\n\s+query\.{mn}[^\n]*\n\s+\? \{{ gte: query\.{mn}, lte: query\.{mx} \}}\n\s+: undefined,'
    replacement = f"...({{ {field}: omitUndefined({{ ...(query.{mn} !== undefined ? {{ gte: query.{mn} }} : {{}}), ...(query.{mx} !== undefined ? {{ lte: query.{mx} }} : {{}}) }}) }}),"
    text = re.sub(pattern, replacement, text, count=1, flags=re.MULTILINE)
text = text.replace(
    'is: { maxPrice: { gte: query.minPrice, lte: query.maxPrice } },',
    'is: { maxPrice: omitUndefined({ ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}), ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}) }) },',
)
p.write_text(text)

# Keep PageResult available through the existing repository contract.
p = ROOT / 'src/modules/property/domain/repositories/property-master.repository.ts'
text = p.read_text()
if "export type { PageResult } from '../property-master.types.js';" not in text:
    text = "export type { PageResult } from '../property-master.types.js';\n" + text
p.write_text(text)
