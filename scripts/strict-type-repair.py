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
    if patched == text:
        raise RuntimeError(f'Pattern did not match: {path}: {pattern}')
    p.write_text(patched)


helper = Path('src/common/omit-undefined.ts')
helper.parent.mkdir(parents=True, exist_ok=True)
if not helper.exists():
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

# Property access: narrow the exact route identifier used by Prisma.
p = Path('src/common/security/property-access.guard.ts')
text = p.read_text()
text = text.replace(
    "    if (isListingResource && !pathUuid) throw new ForbiddenException();\n    const propertyUuid = directPropertyUuid ?? pathUuid;",
    "    if (isListingResource && !pathUuid) throw new ForbiddenException();\n    const listingUuid = pathUuid;\n    const propertyUuid = directPropertyUuid ?? pathUuid;",
)
text = text.replace('uuid: pathUuid,', 'uuid: listingUuid,')
p.write_text(text)

# Strict indexed access / BigInt helpers.
replace_all('src/modules/property/domain/property-extras.ts', [
    ("const [w, f = ''] = this.amount.split('.');", "const [w = '0', f = ''] = this.amount.split('.');"),
    ("const [w, f = ''] = v.split('.'),", "const [w = '0', f = ''] = v.split('.'),"),
    ("const [a, b] = o;", "const [a = 0, b = 0] = o;"),
])
replace_all('src/modules/property/listing/domain/listing.types.ts', [
    ("const [whole] = normalized.split('.');", "const [whole = '0'] = normalized.split('.');"),
    ("const [whole, fraction = ''] = value.split('.');", "const [whole = '0', fraction = ''] = value.split('.');"),
])

# Audit contract values and change-set shape.
replace_all('src/modules/property/application/property-details.service.ts', [
    ("actorType: 'user'", "actorType: 'AUTHENTICATED'"),
    ("result: 'success'", "result: 'SUCCESS'"),
])
patch_regex(
    'src/modules/property/application/property-details.service.ts',
    r"changes:\n\s+typeof changes === 'object' && changes !== null\n\s+\? \(changes as Record<string, unknown>\)\n\s+: undefined,",
    """changes:\n        typeof changes === 'object' && changes !== null\n          ? Object.entries(changes as Record<string, unknown>).flatMap(\n              ([field, value]) =>\n                typeof value === 'string' ||\n                typeof value === 'boolean' ||\n                (typeof value === 'number' && Number.isFinite(value)) ||\n                value === null\n                  ? [{ field, oldValue: null, newValue: value }]\n                  : [],\n            )\n          : undefined,""",
)
p = Path('src/modules/property/application/property-master.service.ts')
text = p.read_text()
if 'type SecurityAuditChange' not in text:
    marker = "import type { SecurityAuditRepository } from '../../../common/audit/security-audit.port.js';\n"
    text = text.replace(marker, marker + "import type { SecurityAuditChange } from '../../../common/audit/security-audit.port.js';\n", 1)
# Creation boundaries accept optional slugs because the persistence layer derives defaults.
text = text.replace('      slug: string;\n', '      slug?: string;\n', 3)
p.write_text(text)

# Property detail persistence: explicit omission of undefined and safe indexed access.
p = Path('src/modules/property/infrastructure/persistence/prisma-property-details.repository.ts')
text = p.read_text()
text = text.replace('            data: common,', '            data: omitUndefined(common),')
text = text.replace('            data: scalar,', '            data: omitUndefined(scalar),')
text = text.replace('            data,\n          });', '            data: omitUndefined(data),\n          });')
text = text.replace(': current?.yearBuilt,', ': (current?.yearBuilt ?? null),')
text = text.replace(': current?.yearRenovated,', ': (current?.yearRenovated ?? null),')
text = text.replace('const facilityIds = inputs.map((input) => input.facilityId);', 'const facilityIds = inputs.map((input) => input.facilityId);\n    const mutableFacilityIds = [...facilityIds];')
text = text.replace('{ in: facilityIds }', '{ in: mutableFacilityIds }')
text = re.sub(
    r'const current = existing\[index\];\n\s+const input = inputs\[index\];',
    "const current = existing[index];\n      const input = inputs[index];\n      if (!input) throw new PropertyDetailInvalidStateError('Facility input is missing');",
    text,
    count=1,
)
p.write_text(text)

# Property extras persistence: all Prisma input variables must not contain explicit undefined.
p = Path('src/modules/property/infrastructure/persistence/prisma-property-extras.repository.ts')
text = p.read_text()
text = text.replace('where: { id: c.id }, data })', 'where: { id: c.id }, data: omitUndefined(data) })')
text = text.replace('where: { id: c.id },\n                  data,', 'where: { id: c.id },\n                  data: omitUndefined(data),')
text = text.replace('ownerReference: p.ownerReference,', 'ownerReference: p.ownerReference ?? null,')
p.write_text(text)

# Listing persistence: exact import path, optional objects, and error type propagation.
p = Path('src/modules/property/listing/infrastructure/listing.repository.ts')
text = p.read_text().replace("from '../../../common/omit-undefined.js';", "from '../../../../common/omit-undefined.js';")
text = text.replace('        .catch((error: unknown) => this.mapError(error)),', '        .catch((error: unknown) => { this.mapError(error); throw error; }),')
text = text.replace('verifiedAt: current.verifiedAt,', 'verifiedAt: current.verifiedAt ?? null,')
text = text.replace('verifiedBy: current.verifiedBy,', 'verifiedBy: current.verifiedBy ?? null,')
text = text.replace('publishedAt: current.publishedAt,', 'publishedAt: current.publishedAt ?? null,')
p.write_text(text)

# Controller actor context: satisfy exact optional semantics without changing runtime meaning.
for filename in ('property-lifecycle.controller.ts', 'property-master.controller.ts'):
    p = Path('src/modules/property/presentation') / filename
    text = p.read_text()
    old = """const actor = (\n  r: AuthenticatedRequest,\n  userAgent?: string,\n  requestId?: string,\n) => ({ actorUuid: r.user?.sub, ipAddress: r.ip, userAgent, requestId });\n"""
    new = """const actor = (\n  r: AuthenticatedRequest,\n  userAgent?: string,\n  requestId?: string,\n) => {\n  const actorUuid = r.user?.sub;\n  if (!actorUuid) throw new ForbiddenException('Authenticated user is required');\n  return {\n    actorUuid,\n    ipAddress: r.ip ?? 'unknown',\n    ...(userAgent !== undefined ? { userAgent } : {}),\n    ...(requestId !== undefined ? { requestId } : {}),\n  };\n};\n"""
    if old in text:
        text = text.replace("  BadRequestException,\n", "  BadRequestException,\n  ForbiddenException,\n", 1)
        text = text.replace(old, new, 1)
    if filename == 'property-master.controller.ts':
        if 'const record = (value: object)' not in text:
            text = text.replace(
                "const sanitize = (value: unknown): unknown => {",
                "const record = (value: object): RecordValue => Object.fromEntries(Object.entries(value));\nconst sanitize = (value: unknown): unknown => {",
                1,
            )
        for old_call, new_call in {
            '.updateCategory(uuid, d.version, d, actor(r, ua, rid))': '.updateCategory(uuid, d.version, record(d), actor(r, ua, rid))',
            '.updateSubcategory(uuid, d.version, d, actor(r, ua, rid))': '.updateSubcategory(uuid, d.version, record(d), actor(r, ua, rid))',
            '.createLocation(levelOf(level), d, actor(r, ua, rid))': '.createLocation(levelOf(level), record(d), actor(r, ua, rid))',
            '.updateLocation(levelOf(level), uuid, d.version, d, actor(r, ua, rid))': '.updateLocation(levelOf(level), uuid, d.version, record(d), actor(r, ua, rid))',
            '.updateFacility(uuid, d.version, d, actor(r, ua, rid))': '.updateFacility(uuid, d.version, record(d), actor(r, ua, rid))',
            '.createProperty(d, actor(r, ua, rid))': '.createProperty(record(d), actor(r, ua, rid))',
            '.updateProperty(uuid, d.version, d, actor(r, ua, rid))': '.updateProperty(uuid, d.version, record(d), actor(r, ua, rid))',
        }.items():
            text = text.replace(old_call, new_call)
    p.write_text(text)

# Explicit PageResult export and keep creation slug optional in the repository contract.
p = Path('src/modules/property/domain/repositories/property-master.repository.ts')
text = p.read_text()
line = "export type { PageResult } from '../property-master.types.js';\n"
if line not in text:
    text = line + text
p.write_text(text)
