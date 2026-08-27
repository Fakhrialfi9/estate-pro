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

# Common strictness fixes.
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

# Persistence helper imports.
for path in ('src/modules/property/infrastructure/persistence/prisma-property-details.repository.ts','src/modules/property/infrastructure/persistence/prisma-property-extras.repository.ts','src/modules/property/listing/infrastructure/listing.repository.ts'):
    p = Path(path)
    text = p.read_text()
    if 'omit-undefined.js' not in text:
        text = "import { omitUndefined } from '../../../../common/omit-undefined.js';\n" + text
    p.write_text(text)

# Property details repository.
p = Path('src/modules/property/infrastructure/persistence/prisma-property-details.repository.ts')
text = p.read_text()
text = text.replace(': current?.yearBuilt,', ': (current?.yearBuilt ?? null),').replace(': current?.yearRenovated,', ': (current?.yearRenovated ?? null),')
text = text.replace('data: common,', 'data: omitUndefined(common),').replace('data: scalar,', 'data: omitUndefined(scalar),').replace('facilityId: { in: facilityIds },', 'facilityId: { in: Array.from(facilityIds) },')
text = text.replace('          data: {\n            roomType: patch.roomType,', '          data: omitUndefined({\n            roomType: patch.roomType,', 1)
text = text.replace('            updatedBy: actor.actorUuid ?? null,\n          },\n        });\n      });\n    } catch', '            updatedBy: actor.actorUuid ?? null,\n          }),\n        });\n      });\n    } catch', 1)
text = text.replace('          data: {\n            available: patch.available,', '          data: omitUndefined({\n            available: patch.available,', 1)
text = text.replace('            updatedAt: new Date(),\n          },\n          include:', '            updatedAt: new Date(),\n          }),\n          include:', 1)
# Narrow bulk indexed input.
text = text.replace('      for (let index = 0; index < inputs.length; index++) {\n        const uuid = inputs[index].facilityUuid;', '      for (let index = 0; index < inputs.length; index++) {\n        const input = inputs[index];\n        if (!input) throw new PropertyDetailInvalidStateError(\'Facility input is missing\');\n        const uuid = input.facilityUuid;')
text = text.replace('inputs[index].available', 'input.available').replace('inputs[index].quantity', 'input.quantity').replace('inputs[index].notes', 'input.notes')
p.write_text(text)

# Extras repository.
p = Path('src/modules/property/infrastructure/persistence/prisma-property-extras.repository.ts')
text = p.read_text()
text = text.replace('ownerReference: p.ownerReference,', 'ownerReference: p.ownerReference ?? null,')
text = text.replace('ownerReferenceHash:\n                  owner === undefined || owner === null\n                    ? null\n                    : hashSensitive(owner),\n                ownerReferenceMasked:\n                  owner === undefined || owner === null\n                    ? null\n                    : maskSensitive(owner),\n                ...data,', '...omitUndefined(data),')
text = text.replace('where: { id: c.id }, data })', 'where: { id: c.id }, data: omitUndefined(data) })')
text = text.replace('where: { id: c.id },\n                  data,', 'where: { id: c.id },\n                  data: omitUndefined(data),')
# Certificate/media literal Prisma data should never contain explicit undefined.
text = text.replace('          data: {\n            uuid: randomUUID(),\n            propertyId: id,\n            type: p.type,\n            numberHash:', '          data: omitUndefined({\n            uuid: randomUUID(),\n            propertyId: id,\n            type: p.type,\n            numberHash:', 1)
text = text.replace('            updatedBy: sid(a),\n          },\n        });\n        return this.certificate(r);', '            updatedBy: sid(a),\n          }),\n        });\n        return this.certificate(r);', 1)
text = text.replace('          data: {\n            type: p.type,\n            numberHash:', '          data: omitUndefined({\n            type: p.type,\n            numberHash:', 1)
text = text.replace('            updatedBy: sid(a),\n          },\n        });\n        return this.certificate(r);', '            updatedBy: sid(a),\n          }),\n        });\n        return this.certificate(r);', 1)
text = text.replace('          data: {\n            uuid: randomUUID(),\n            propertyId: id,\n            type: p.type,', '          data: omitUndefined({\n            uuid: randomUUID(),\n            propertyId: id,\n            type: p.type,', 1)
text = text.replace('            updatedBy: sid(a),\n          },\n        });\n        return this.media(r);', '            updatedBy: sid(a),\n          }),\n        });\n        return this.media(r);', 1)
text = text.replace('          data: {\n            type: m.type,\n            category: m.category,', '          data: omitUndefined({\n            type: m.type,\n            category: m.category,', 1)
text = text.replace('            updatedBy: sid(a),\n          },\n        });\n        return this.media(r);', '            updatedBy: sid(a),\n          }),\n        });\n        return this.media(r);', 1)
p.write_text(text)

# Master service and store contracts.
p = Path('src/modules/property/application/property-master.service.ts')
text = p.read_text()
text = text.replace("import type { SecurityAuditRepository } from '../../../common/audit/security-audit.port.js';", "import type { SecurityAuditChange, SecurityAuditRepository } from '../../../common/audit/security-audit.port.js';")
text = text.replace('      slug: string;\n', '      slug?: string;\n', 3)
p.write_text(text)

p = Path('src/modules/property/infrastructure/persistence/prisma-property-master.store.ts')
text = p.read_text()
text = text.replace('  PageResult,\n', '')
if "import type { PageResult } from '../../domain/property-master.types.js';" not in text:
    marker = "import type {\n  MasterQuery,\n  PropertyMasterRepository,\n} from '../../domain/repositories/property-master.repository.js';\n"
    text = text.replace(marker, marker + "import type { PageResult } from '../../domain/property-master.types.js';\n", 1)
text = text.replace('const field = q.sortBy && allowed.includes(q.sortBy) ? q.sortBy : allowed[0];', "const field = q.sortBy && allowed.includes(q.sortBy) ? q.sortBy : (allowed[0] ?? 'uuid');")
p.write_text(text)

# Presentation layer: authentication context and DTO-to-record conversion.
for filename in ('property-lifecycle.controller.ts', 'property-master.controller.ts'):
    p = Path('src/modules/property/presentation') / filename
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

# Listing repository: conditionally construct nested objects and filters.
p = Path('src/modules/property/listing/infrastructure/listing.repository.ts')
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
"""              paymentOptions: input.payments?.length
                ? {
                    create: input.payments.map((payment) => ({""",
"""              ...(input.payments?.length
                ? {
                    paymentOptions: {
                      create: input.payments.map((payment) => ({"""
)
text = text.replace(
"""                  }
                : undefined,
              analytics:""",
"""                    },
                  }
                : {}),
              analytics:""", 1)
text = text.replace('            data: {\n              listingCode: input.listingCode?.trim(),', '            data: omitUndefined({\n              listingCode: input.listingCode?.trim(),', 1)
text = text.replace('              version: { increment: 1 },\n            },\n          });', '              version: { increment: 1 },\n            }),\n          });', 1)
text = text.replace('          const data: Prisma.PropertyListingUpdateManyMutationInput = {', '          const data: Prisma.PropertyListingUpdateManyMutationInput = omitUndefined({')
# close typed transition data declaration.
text = text.replace('            version: { increment: 1 },\n          };\n          if (to === \'PUBLISHED\')', '            version: { increment: 1 },\n          });\n          if (to === \'PUBLISHED\')', 1)
text = text.replace('                data: {\n                status: \'EXPIRED\',', '                data: omitUndefined({\n                status: \'EXPIRED\',')
text = text.replace('                version: { increment: 1 },\n              },\n            });', '                version: { increment: 1 },\n              }),\n            });', 1)
# duplicate listing price relation.
text = text.replace(
"""              price: source.price
                ? {
                    create: {""",
"""              ...(source.price
                ? {
                    price: {
                      create: {""", 1)
text = text.replace('                  }\n                : undefined,\n              paymentOptions:', '                    },\n                  }\n                : {}),\n              paymentOptions:', 1)
# Selector engagement optional relation.
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
          : {}),""", 1)
# Location relation filters and ranges.
for key, name in (('country','countryUuid'),('province','provinceUuid'),('city','cityUuid'),('district','districtUuid')):
    text = text.replace(f'          {key}: {name} ? {{ is: {{ uuid: {name} }} }} : undefined,', f'          ...({name} ? {{ {key}: {{ is: {{ uuid: {name} }} }} }} : {{}}),')
for field, mn, mx in (('landArea','minLandArea','maxLandArea'),('buildingArea','minBuildingArea','maxBuildingArea'),('bedrooms','minBedrooms','maxBedrooms'),('bathrooms','minBathrooms','maxBathrooms')):
    pattern = rf'{field}:\n\s+{mn} !== undefined \|\| {mx} !== undefined\n\s+\? \{{ gte: {mn}, lte: {mx} \}}\n\s+: undefined,'
    replacement = f"...({mn} !== undefined || {mx} !== undefined ? {{ {field}: omitUndefined({{ ...({mn} !== undefined ? {{ gte: {mn} }} : {{}}), ...({mx} !== undefined ? {{ lte: {mx} }} : {{}}) }}) }} : {{}}),"
    text = re.sub(pattern, replacement, text, count=1, flags=re.MULTILINE)
text = text.replace('is: { maxPrice: { gte: query.minPrice, lte: query.maxPrice } },', 'is: { maxPrice: omitUndefined({ ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}), ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}) }) },')
# run() must reject, not return Error.
text = text.replace('return this.mapError(error);', 'throw this.mapError(error);')
p.write_text(text)

# Repository PageResult re-export remains available for existing consumers.
p = Path('src/modules/property/domain/repositories/property-master.repository.ts')
text = p.read_text()
if "export type { PageResult } from '../property-master.types.js';" not in text:
    text = "export type { PageResult } from '../property-master.types.js';\n" + text
p.write_text(text)
