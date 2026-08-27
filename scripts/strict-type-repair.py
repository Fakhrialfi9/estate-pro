from pathlib import Path
import re


def replace_all(path: str, replacements: list[tuple[str, str]]) -> None:
    p = Path(path)
    text = p.read_text()
    for old, new in replacements:
        text = text.replace(old, new)
    p.write_text(text)


def patch_regex(path: str, pattern: str, replacement: str) -> None:
    p = Path(path)
    text = p.read_text()
    patched = re.sub(pattern, replacement, text, count=1, flags=re.MULTILINE | re.DOTALL)
    if patched != text:
        p.write_text(patched)

helper = Path('src/common/omit-undefined.ts')
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

replace_all('src/common/security/property-access.guard.ts', [
    ('uuid: pathUuid,', 'uuid: propertyUuid,'),
])
replace_all('src/modules/property/application/property-details.service.ts', [
    ("actorType: 'user'", "actorType: 'AUTHENTICATED'"),
    ("result: 'success'", "result: 'SUCCESS'"),
])
patch_regex(
    'src/modules/property/application/property-details.service.ts',
    r"changes:\n\s+typeof changes === 'object' && changes !== null\n\s+\? \(changes as Record<string, unknown>\)\n\s+: undefined,",
    """changes:
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
          : undefined,""",
)

p = Path('src/modules/property/application/property-master.service.ts')
text = p.read_text()
marker = "import type { SecurityAuditRepository } from '../../../common/audit/security-audit.port.js';\n"
if marker in text and 'SecurityAuditChange' not in text:
    text = text.replace(marker, "import type { SecurityAuditChange, SecurityAuditRepository } from '../../../common/audit/security-audit.port.js';\n", 1)
p.write_text(text)

replace_all('src/modules/property/domain/property-extras.ts', [
    ("const [w, f = ''] = this.amount.split('.');", "const [w = '0', f = ''] = this.amount.split('.');"),
    ("const [w, f = ''] = v.split('.'),", "const [w = '0', f = ''] = v.split('.'),"),
    ("const [a, b] = o;", "const [a = 0, b = 0] = o;"),
])
replace_all('src/modules/property/listing/domain/listing.types.ts', [
    ("const [whole, fraction = ''] = normalized.split('.');", "const [whole = '0', fraction = ''] = normalized.split('.');"),
])

for path in (
    'src/modules/property/infrastructure/persistence/prisma-property-details.repository.ts',
    'src/modules/property/infrastructure/persistence/prisma-property-extras.repository.ts',
    'src/modules/property/listing/infrastructure/listing.repository.ts',
):
    p = Path(path)
    text = p.read_text()
    if 'omit-undefined.js' not in text:
        text = "import { omitUndefined } from '../../../../common/omit-undefined.js';\n" + text
    p.write_text(text)

p = Path('src/modules/property/infrastructure/persistence/prisma-property-details.repository.ts')
text = p.read_text()
text = text.replace(': current?.yearBuilt,', ': (current?.yearBuilt ?? null),')
text = text.replace(': current?.yearRenovated,', ': (current?.yearRenovated ?? null),')
text = text.replace('data: common,', 'data: omitUndefined(common),')
text = text.replace('data: scalar,', 'data: omitUndefined(scalar),')
text = text.replace('facilityId: { in: facilityIds },', 'facilityId: { in: Array.from(facilityIds) },')
text = re.sub(r'(for \(let index = 0; index < inputs\.length; index\+\+\) \{\n\s+)(const current = existing\[index\];\n\s+const input = inputs\[index\];)', r'\1const current = existing[index];\n      const input = inputs[index];\n      if (!input) continue;', text, count=1)
text = text.replace('inputs[index].available', 'input.available')
text = text.replace('inputs[index].quantity', 'input.quantity')
text = text.replace('inputs[index].notes', 'input.notes')
text = text.replace('            data,\n          });', '            data: omitUndefined(data),\n          });')
p.write_text(text)

p = Path('src/modules/property/infrastructure/persistence/prisma-property-extras.repository.ts')
text = p.read_text()
text = text.replace('ownerReference: p.ownerReference,', 'ownerReference: p.ownerReference ?? null,')
text = text.replace('where: { id: c.id }, data })', 'where: { id: c.id }, data: omitUndefined(data) })')
text = text.replace('where: { id: c.id },\n                  data,', 'where: { id: c.id },\n                  data: omitUndefined(data),')
text = text.replace('                ...data,', '                ...omitUndefined(data),')
p.write_text(text)

p = Path('src/modules/property/listing/infrastructure/listing.repository.ts')
text = p.read_text()
text = text.replace("from '../../../common/omit-undefined.js';", "from '../../../../common/omit-undefined.js';")
text = text.replace('verifiedAt: current.verifiedAt,', 'verifiedAt: current.verifiedAt ?? null,')
text = text.replace('verifiedBy: current.verifiedBy,', 'verifiedBy: current.verifiedBy ?? null,')
text = text.replace('publishedAt: current.publishedAt,', 'publishedAt: current.publishedAt ?? null,')
text = text.replace('          engagements: engagementUserUuid\n            ? {\n                where: { userUuid: engagementUserUuid },\n                select: { isSaved: true, viewedAt: true },\n              }\n            : undefined,', '          ...(engagementUserUuid\n            ? { engagements: { where: { userUuid: engagementUserUuid }, select: { isSaved: true, viewedAt: true } } }\n            : {}),')
text = text.replace('          country: countryUuid ? { is: { uuid: countryUuid } } : undefined,', '          ...(countryUuid ? { country: { is: { uuid: countryUuid } } } : {}),')
text = text.replace('          province: provinceUuid ? { is: { uuid: provinceUuid } } : undefined,', '          ...(provinceUuid ? { province: { is: { uuid: provinceUuid } } } : {}),')
text = text.replace('          city: cityUuid ? { is: { uuid: cityUuid } } : undefined,', '          ...(cityUuid ? { city: { is: { uuid: cityUuid } } } : {}),')
text = text.replace('          district: districtUuid ? { is: { uuid: districtUuid } } : undefined,', '          ...(districtUuid ? { district: { is: { uuid: districtUuid } } } : {}),')
for field, mn, mx in (('landArea','minLandArea','maxLandArea'),('buildingArea','minBuildingArea','maxBuildingArea'),('bedrooms','minBedrooms','maxBedrooms'),('bathrooms','minBathrooms','maxBathrooms')):
    pattern = rf'{field}:\n\s+{mn} !== undefined \|\| {mx} !== undefined\n\s+\? \{{ gte: {mn}, lte: {mx} \}}\n\s+: undefined,'
    replacement = f"...({mn} !== undefined || {mx} !== undefined ? {{ {field}: omitUndefined({{ ...({mn} !== undefined ? {{ gte: {mn} }} : {{}}), ...({mx} !== undefined ? {{ lte: {mx} }} : {{}}) }}) }} : {{}}),"
    text = re.sub(pattern, replacement, text, count=1, flags=re.MULTILINE)
text = text.replace('is: { maxPrice: { gte: query.minPrice, lte: query.maxPrice } },', 'is: { maxPrice: omitUndefined({ ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}), ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}) }) },')
p.write_text(text)

p = Path('src/modules/property/infrastructure/persistence/prisma-property-master.store.ts')
text = p.read_text()
text = text.replace('  PageResult,\n', '')
if "import type { PageResult } from '../../domain/property-master.types.js';" not in text:
    marker = "import type { PropertyMasterRepository } from '../../domain/repositories/property-master.repository.js';\n"
    if marker in text:
        text = text.replace(marker, marker + "import type { PageResult } from '../../domain/property-master.types.js';\n", 1)
text = text.replace('const field = q.sortBy && allowed.includes(q.sortBy) ? q.sortBy : allowed[0];', "const field = q.sortBy && allowed.includes(q.sortBy) ? q.sortBy : (allowed[0] ?? 'uuid');")
text = text.replace('return this.prisma.facility.update({ where: { id: current.id }, data });', "const id = current.id;\n      if (typeof id !== 'number' && typeof id !== 'bigint') throw new MasterNotFoundError('Facility id is invalid');\n      return this.prisma.facility.update({ where: { id }, data });")
text = text.replace("availabilityStatus: text(input.availabilityStatus, 'AVAILABLE'),", "availabilityStatus: text(input.availabilityStatus, 'AVAILABLE') === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE',")
p.write_text(text)

for filename in ('property-lifecycle.controller.ts', 'property-master.controller.ts'):
    p = Path('src/modules/property/presentation') / filename
    text = p.read_text()
    old = """const actor = (\n  r: AuthenticatedRequest,\n  userAgent?: string,\n  requestId?: string,\n) => ({ actorUuid: r.user?.sub, ipAddress: r.ip, userAgent, requestId });\n"""
    new = """const actor = (\n  r: AuthenticatedRequest,\n  userAgent?: string,\n  requestId?: string,\n) => {\n  const actorUuid = r.user?.sub;\n  if (!actorUuid) throw new ForbiddenException('Authenticated user is required');\n  return {\n    actorUuid,\n    ipAddress: r.ip ?? 'unknown',\n    ...(userAgent !== undefined ? { userAgent } : {}),\n    ...(requestId !== undefined ? { requestId } : {}),\n  };\n};\n"""
    if old in text:
        text = text.replace('  BadRequestException,\n', '  BadRequestException,\n  ForbiddenException,\n', 1)
        text = text.replace(old, new, 1)
    if filename == 'property-master.controller.ts':
        text = text.replace('createCategory(d, actor(r, ua, rid))', 'createCategory({ ...d }, actor(r, ua, rid))')
        text = text.replace('.updateCategory(uuid, d.version, d, actor(r, ua, rid))', '.updateCategory(uuid, d.version, { ...d }, actor(r, ua, rid))')
        text = text.replace('createSubcategory(d, actor(r, ua, rid))', 'createSubcategory({ ...d }, actor(r, ua, rid))')
        text = text.replace('.updateSubcategory(uuid, d.version, d, actor(r, ua, rid))', '.updateSubcategory(uuid, d.version, { ...d }, actor(r, ua, rid))')
        text = text.replace('.createLocation(levelOf(level), d, actor(r, ua, rid))', '.createLocation(levelOf(level), { ...d }, actor(r, ua, rid))')
        text = text.replace('.updateLocation(levelOf(level), uuid, d.version, d, actor(r, ua, rid))', '.updateLocation(levelOf(level), uuid, d.version, { ...d }, actor(r, ua, rid))')
        text = text.replace('createFacility(d, actor(r, ua, rid))', 'createFacility({ ...d }, actor(r, ua, rid))')
        text = text.replace('.updateFacility(uuid, d.version, d, actor(r, ua, rid))', '.updateFacility(uuid, d.version, { ...d }, actor(r, ua, rid))')
        text = text.replace('createProperty(d, actor(r, ua, rid))', 'createProperty({ ...d }, actor(r, ua, rid))')
        text = text.replace('.updateProperty(uuid, d.version, d, actor(r, ua, rid))', '.updateProperty(uuid, d.version, { ...d }, actor(r, ua, rid))')
    p.write_text(text)

# Repository contract re-export.
p = Path('src/modules/property/domain/repositories/property-master.repository.ts')
text = p.read_text()
if "export type { PageResult } from '../property-master.types.js';" not in text:
    text = "export type { PageResult } from '../property-master.types.js';\n" + text
p.write_text(text)
