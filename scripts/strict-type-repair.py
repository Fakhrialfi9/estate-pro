from pathlib import Path


def match_brace(text: str, start: int) -> int:
    depth = 0
    quote = None
    i = start
    while i < len(text):
        c = text[i]
        if quote:
            if c == "\\":
                i += 2
                continue
            if c == quote:
                quote = None
            i += 1
            continue
        if c in "'\"`":
            quote = c
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise RuntimeError("Unbalanced object literal")


def wrap_properties(path: Path, names: tuple[str, ...]) -> None:
    text = path.read_text()
    positions: list[tuple[int, str, int]] = []
    for name in names:
        token = f"{name}: {{"
        cursor = 0
        while True:
            pos = text.find(token, cursor)
            if pos < 0:
                break
            if "omitUndefined(" not in text[max(0, pos - 48) : pos]:
                positions.append((pos, name, pos + len(token) - 1))
            cursor = pos + len(token)

    changed = False
    for pos, name, brace in sorted(positions, reverse=True):
        end = match_brace(text, brace)
        text = text[:pos] + f"{name}: omitUndefined(" + text[pos + len(name) + 2 :]
        text = text[: end + len("omitUndefined(") + 1] + ")" + text[end + len("omitUndefined(") + 1 :]
        changed = True

    if not changed:
        return
    import_line = (
        "import { omitUndefined } from '../../../common/omit-undefined.js';\n"
        if "listing/infrastructure" in str(path)
        else "import { omitUndefined } from '../../../../common/omit-undefined.js';\n"
    )
    if "omit-undefined.js" not in text:
        text = import_line + text
    path.write_text(text)


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old in text:
        text = text.replace(old, new, 1)
        p.write_text(text)


helper = Path("src/common/omit-undefined.ts")
if not helper.exists():
    helper.write_text(
        """type DeepDefined<T> = T extends Date
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
"""
    )

# Strict indexed access helpers.
replace_once(
    "src/modules/property/domain/property-extras.ts",
    "const [w, f = ''] = this.amount.split('.');",
    "const [w = '0', f = ''] = this.amount.split('.');",
)
replace_once(
    "src/modules/property/domain/property-extras.ts",
    "const [w, f = ''] = v.split('.'),",
    "const [w = '0', f = ''] = v.split('.'),",
)
replace_once(
    "src/modules/property/domain/property-extras.ts",
    "const [a, b] = o;",
    "const [a = 0, b = 0] = o;",
)
replace_once(
    "src/modules/property/listing/domain/listing.types.ts",
    "const [whole] = normalized.split('.');",
    "const [whole = '0'] = normalized.split('.');",
)
replace_once(
    "src/modules/property/listing/domain/listing.types.ts",
    "const [whole, fraction = ''] = value.split('.');",
    "const [whole = '0', fraction = ''] = value.split('.');",
)

# Audit typing.
p = Path("src/modules/property/application/property-details.service.ts")
text = p.read_text()
text = text.replace("actorType: 'user'", "actorType: 'AUTHENTICATED'")
text = text.replace("result: 'success'", "result: 'SUCCESS'")
old = """      changes:
        typeof changes === 'object' && changes !== null
          ? (changes as Record<string, unknown>)
          : undefined,
"""
new = """      changes:
        typeof changes === 'object' && changes !== null
          ? Object.entries(changes as Record<string, unknown>).flatMap(
              ([field, value]) =>
                typeof value === 'string' ||
                typeof value === 'boolean' ||
                (typeof value === 'number' && Number.isFinite(value)) ||
                value === null
                  ? [{ field, oldValue: null, newValue: value }]
                  : [],
            )
          : undefined,
"""
text = text.replace(old, new, 1)
p.write_text(text)

p = Path("src/modules/property/application/property-master.service.ts")
text = p.read_text()
if "type SecurityAuditChange" not in text:
    marker = "import type { SecurityAuditRepository } from '../../../common/audit/security-audit.port.js';\n"
    text = text.replace(
        marker,
        marker + "import type { SecurityAuditChange } from '../../../common/audit/security-audit.port.js';\n",
        1,
    )
p.write_text(text)

# Prisma optional properties: omission is preferable to assigning undefined under exactOptionalPropertyTypes.
for path, names in [
    (Path("src/modules/property/infrastructure/persistence/prisma-property-details.repository.ts"), ("data", "where")),
    (Path("src/modules/property/infrastructure/persistence/prisma-property-extras.repository.ts"), ("data", "where")),
    (Path("src/modules/property/listing/infrastructure/listing.repository.ts"), ("data", "where", "select")),
]:
    wrap_properties(path, names)

# Property detail merge invariants should remain nullable, not undefined.
p = Path("src/modules/property/infrastructure/persistence/prisma-property-details.repository.ts")
text = p.read_text()
text = text.replace(": current?.yearBuilt,", ": (current?.yearBuilt ?? null),")
text = text.replace(": current?.yearRenovated,", ": (current?.yearRenovated ?? null),")
p.write_text(text)

# Repository contract explicitly re-exports PageResult.
p = Path("src/modules/property/domain/repositories/property-master.repository.ts")
text = p.read_text()
line = "export type { PageResult } from '../property-master.types.js';\n"
if line not in text:
    text = line + text
# Creation slugs are derived by persistence and therefore remain optional at the boundary.
text = text.replace("      slug: string;\n", "      slug?: string;\n", 3)
p.write_text(text)

# Master store strict typing.
p = Path("src/modules/property/infrastructure/persistence/prisma-property-master.store.ts")
text = p.read_text()
text = text.replace(
    "import type {\n  MasterQuery,\n  PageResult,\n  PropertyMasterRepository,\n} from '../../domain/repositories/property-master.repository.js';",
    "import type {\n  MasterQuery,\n  PropertyMasterRepository,\n} from '../../domain/repositories/property-master.repository.js';\nimport type { PageResult } from '../../domain/property-master.types.js';",
    1,
)
text = text.replace(
    "const field = q.sortBy && allowed.includes(q.sortBy) ? q.sortBy : allowed[0];",
    "const field = q.sortBy && allowed.includes(q.sortBy) ? q.sortBy : (allowed[0] ?? 'uuid');",
    1,
)
text = text.replace(
    "      return this.prisma.facility.update({ where: { id: current.id }, data });",
    "      const id = current.id;\n      if (typeof id !== 'number' && typeof id !== 'bigint')\n        throw new MasterNotFoundError();\n      return this.prisma.facility.update({ where: { id }, data });",
    1,
)
text = text.replace(
    "availabilityStatus: text(input.availabilityStatus, 'AVAILABLE'),",
    "availabilityStatus: text(input.availabilityStatus, 'AVAILABLE') as 'AVAILABLE' | 'UNAVAILABLE',",
    1,
)
p.write_text(text)

# Presentation actor context and record conversion.
for filename in ("property-lifecycle.controller.ts", "property-master.controller.ts"):
    p = Path("src/modules/property/presentation") / filename
    text = p.read_text()
    old = """const actor = (
  r: AuthenticatedRequest,
  userAgent?: string,
  requestId?: string,
) => ({ actorUuid: r.user?.sub, ipAddress: r.ip, userAgent, requestId });
"""
    new = """const actor = (
  r: AuthenticatedRequest,
  userAgent?: string,
  requestId?: string,
) => {
  const actorUuid = r.user?.sub;
  if (!actorUuid) throw new ForbiddenException('Authenticated user is required');
  return {
    actorUuid,
    ipAddress: r.ip,
    ...(userAgent !== undefined ? { userAgent } : {}),
    ...(requestId !== undefined ? { requestId } : {}),
  };
};
"""
    if old in text:
        text = text.replace("  BadRequestException,\n", "  BadRequestException,\n  ForbiddenException,\n", 1)
        text = text.replace(old, new, 1)
    if filename == "property-master.controller.ts":
        if "const record = (value: object)" not in text:
            text = text.replace(
                "const sanitize = (value: unknown): unknown => {",
                "const record = (value: object): RecordValue => Object.fromEntries(Object.entries(value));\nconst sanitize = (value: unknown): unknown => {",
                1,
            )
        for old_call, new_call in {
            ".updateCategory(uuid, d.version, d, actor(r, ua, rid))": ".updateCategory(uuid, d.version, record(d), actor(r, ua, rid))",
            ".updateSubcategory(uuid, d.version, d, actor(r, ua, rid))": ".updateSubcategory(uuid, d.version, record(d), actor(r, ua, rid))",
            ".createLocation(levelOf(level), d, actor(r, ua, rid))": ".createLocation(levelOf(level), record(d), actor(r, ua, rid))",
            ".updateLocation(levelOf(level), uuid, d.version, d, actor(r, ua, rid))": ".updateLocation(levelOf(level), uuid, d.version, record(d), actor(r, ua, rid))",
            ".updateFacility(uuid, d.version, d, actor(r, ua, rid))": ".updateFacility(uuid, d.version, record(d), actor(r, ua, rid))",
            ".createProperty(d, actor(r, ua, rid))": ".createProperty(record(d), actor(r, ua, rid))",
            ".updateProperty(uuid, d.version, d, actor(r, ua, rid))": ".updateProperty(uuid, d.version, record(d), actor(r, ua, rid))",
        }.items():
            text = text.replace(old_call, new_call)
    p.write_text(text)
