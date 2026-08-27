# Deterministic strict-type repair script for main-branch validation.
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

# Initial safe fixes shared by all repair attempts.
replace_all('src/common/security/property-access.guard.ts', [('uuid: pathUuid,', 'uuid: propertyUuid,')])
replace_all('src/modules/property/application/property-details.service.ts', [("actorType: 'user'", "actorType: 'AUTHENTICATED'"), ("result: 'success'", "result: 'SUCCESS'")])
patch_regex('src/modules/property/application/property-details.service.ts', r"changes:\n\s+typeof changes === 'object' && changes !== null\n\s+\? \(changes as Record<string, unknown>\)\n\s+: undefined,", """changes:
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
          : undefined,""")

replace_all('src/modules/property/domain/property-extras.ts', [("const [w, f = ''] = this.amount.split('.');", "const [w = '0', f = ''] = this.amount.split('.');"), ("const [w, f = ''] = v.split('.'),", "const [w = '0', f = ''] = v.split('.'),"), ("const [a, b] = o;", "const [a = 0, b = 0] = o;")])
replace_all('src/modules/property/listing/domain/listing.types.ts', [("const [whole, fraction = ''] = normalized.split('.');", "const [whole = '0', fraction = ''] = normalized.split('.');")])

# Add the helper at persistence boundaries.
for path in ('src/modules/property/infrastructure/persistence/prisma-property-details.repository.ts','src/modules/property/infrastructure/persistence/prisma-property-extras.repository.ts','src/modules/property/listing/infrastructure/listing.repository.ts'):
    p = Path(path)
    text = p.read_text()
    if 'omit-undefined.js' not in text:
        text = "import { omitUndefined } from '../../../../common/omit-undefined.js';\n" + text
    p.write_text(text)

# Details repository.
p = Path('src/modules/property/infrastructure/persistence/prisma-property-details.repository.ts')
text = p.read_text()
text = text.replace(': current?.yearBuilt,', ': (current?.yearBuilt ?? null),')
text = text.replace(': current?.yearRenovated,', ': (current?.yearRenovated ?? null),')
text = text.replace('data: common,', 'data: omitUndefined(common),')
text = text.replace('data: scalar,', 'data: omitUndefined(scalar),')
text = text.replace('facilityId: { in: facilityIds },', 'facilityId: { in: Array.from(facilityIds) },')
text = text.replace('            data,\n          });', '            data: omitUndefined(data),\n          });')
# Room update and facility update are patch-shaped objects; omission is semantically correct.
text = text.replace('          data: {\n            roomType: patch.roomType,', '          data: omitUndefined({\n            roomType: patch.roomType,', 1)
text = text.replace('            updatedBy: actor.actorUuid ?? null,\n          },\n        });\n      });', '            updatedBy: actor.actorUuid ?? null,\n          }),\n        });\n      });', 1)
text = text.replace('          data: {\n            available: patch.available,', '          data: omitUndefined({\n            available: patch.available,', 1)
text = text.replace('            updatedAt: new Date(),\n          },\n          include:', '            updatedAt: new Date(),\n          }),\n          include:', 1)
text = re.sub(r'(for \(const \[index, input\] of inputs\.entries\(\)\) \{)', r'\1', text)
# The bulk facility loop must narrow the indexed element before reading it.
text = text.replace('      for (let index = 0; index < inputs.length; index++) {\n        const uuid = inputs[index].facilityUuid;', '      for (let index = 0; index < inputs.length; index++) {\n        const input = inputs[index];\n        if (!input) throw new PropertyDetailInvalidStateError(\'Facility input is missing\');\n        const uuid = input.facilityUuid;')
text = text.replace('inputs[index].facilityUuid', 'input.facilityUuid')
text = text.replace('inputs[index].available', 'input.available').replace('inputs[index].quantity', 'input.quantity').replace('inputs[index].notes', 'input.notes')
p.write_text(text)

# Extras repository.
p = Path('src/modules/property/infrastructure/persistence/prisma-property-extras.repository.ts')
text = p.read_text()
text = text.replace('ownerReference: p.ownerReference,', 'ownerReference: p.ownerReference ?? null,')
text = text.replace('where: { id: c.id }, data })', 'where: { id: c.id }, data: omitUndefined(data) })')
text = text.replace('where: { id: c.id },\n                  data,', 'where: { id: c.id },\n                  data: omitUndefined(data),')
text = text.replace('                ...data,', '                ...omitUndefined(data),').replace('                  ...data,', '                  ...omitUndefined(data),')
# Certificate create/update and media create/update use DTO patches: remove undefined keys at Prisma boundary.
for delegate, call in (
    ('propertyCertificate', 'create'),
    ('propertyCertificate', 'update'),
    ('propertyMedia', 'create'),
    ('propertyMedia', 'update'),
):
    pattern = rf'(tx\.{delegate}\.{call}\(\{{\n\s+data: )\{{'
    text = re.sub(pattern, r'\1omitUndefined({', text, count=1)
# Close the four wrapped data objects at their call boundary.
for marker in ('        });', '      });'):
    pass
# Target the known trailing fields so the wrapper closes without affecting sibling objects.
text = text.replace('            updatedBy: sid(a),\n          },\n        });\n      });', '            updatedBy: sid(a),\n          }),\n        });\n      });')
text = text.replace('            updatedBy: sid(a),\n          },\n      });', '            updatedBy: sid(a),\n          }),\n      });')
p.write_text(text)

# Master service contracts mirror persistence defaults: slug is optional and derived from name.
p = Path('src/modules/property/application/property-master.service.ts')
text = p.read_text()
text = text.replace('      slug: string;\n', '      slug?: string;\n', 3)
text = text.replace('import type { SecurityAuditRepository } from \'../../../common/audit/security-audit.port.js\';', 'import type { SecurityAuditChange, SecurityAuditRepository } from \'../../../common/audit/security-audit.port.js\';')
p.write_text(text)

# Master store imports the pagination type from its defining module, not through the repository interface.
p = Path('src/modules/property/infrastructure/persistence/prisma-property-master.store.ts')
text = p.read_text()
text = text.replace('  PageResult,\n', '')
if "import type { PageResult } from '../../domain/property-master.types.js';" not in text:
    marker = "import type { PropertyMasterRepository } from '../../domain/repositories/property-master.repository.js';\n"
    text = text.replace(marker, marker + "import type { PageResult } from '../../domain/property-master.types.js';\n", 1)
text = text.replace('const field = q.sortBy && allowed.includes(q.sortBy) ? q.sortBy : allowed[0];', "const field = q.sortBy && allowed.includes(q.sortBy) ? q.sortBy : (allowed[0] ?? 'uuid');")
p.write_text(text)

# Presentation actor context and record conversions.
for filename in ('property-lifecycle.controller.ts', 'property-master.controller.ts'):
    p = Path('src/modules/property/presentation') / filename
    text = p.read_text()
    old = """const actor = (\n  r: AuthenticatedRequest,\n  userAgent?: string,\n  requestId?: string,\n) => ({ actorUuid: r.user?.sub, ipAddress: r.ip, userAgent, requestId });\n"""
    if old in text:
        text = text.replace('  BadRequestException,\n', '  BadRequestException,\n  ForbiddenException,\n', 1)
        text = text.replace(old, """const actor = (\n  r: AuthenticatedRequest,\n  userAgent?: string,\n  requestId?: string,\n) => {\n  const actorUuid = r.user?.sub;\n  if (!actorUuid) throw new ForbiddenException('Authenticated user is required');\n  return {\n    actorUuid,\n    ipAddress: r.ip ?? 'unknown',\n    ...(userAgent !== undefined ? { userAgent } : {}),\n    ...(requestId !== undefined ? { requestId } : {}),\n  };\n};\n""", 1)
    if filename == 'property-master.controller.ts':
        if 'const toRecord = (value: object)' not in text:
            marker = 'type RecordValue = Record<string, unknown>;\n'
            text = text.replace(marker, marker + 'const toRecord = (value: object): RecordValue => Object.fromEntries(Object.entries(value));\n', 1)
        for old_call, new_call in {
            '.updateCategory(uuid, d.version, d, actor(r, ua, rid))': '.updateCategory(uuid, d.version, toRecord(d), actor(r, ua, rid))',
            '.updateSubcategory(uuid, d.version, d, actor(r, ua, rid))': '.updateSubcategory(uuid, d.version, toRecord(d), actor(r, ua, rid))',
            '.createLocation(levelOf(level), d, actor(r, ua, rid))': '.createLocation(levelOf(level), toRecord(d), actor(r, ua, rid))',
            '.updateLocation(levelOf(level), uuid, d.version, d, actor(r, ua, rid))': '.updateLocation(levelOf(level), uuid, d.version, toRecord(d), actor(r, ua, rid))',
            '.updateFacility(uuid, d.version, d, actor(r, ua, rid))': '.updateFacility(uuid, d.version, toRecord(d), actor(r, ua, rid))',
            '.createProperty(d, actor(r, ua, rid))': '.createProperty(toRecord(d), actor(r, ua, rid))',
            '.updateProperty(uuid, d.version, d, actor(r, ua, rid))': '.updateProperty(uuid, d.version, toRecord(d), actor(r, ua, rid))',
        }.items():
            text = text.replace(old_call, new_call)
    p.write_text(text)

# Keep repository contract backwards-compatible for its existing PageResult consumers.
p = Path('src/modules/property/domain/repositories/property-master.repository.ts')
text = p.read_text()
if "export type { PageResult } from '../property-master.types.js';" not in text:
    text = "export type { PageResult } from '../property-master.types.js';\n" + text
p.write_text(text)
