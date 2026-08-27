from pathlib import Path
import re


def replace(path: str, old: str, new: str, count: int = -1) -> None:
    p = Path(path)
    text = p.read_text()
    updated = text.replace(old, new, count)
    if updated != text:
        p.write_text(updated)


def wrap_data_after(path: str, anchor: str) -> None:
    p = Path(path)
    text = p.read_text()
    start = text.find(anchor)
    if start < 0:
        return
    data_pos = text.find('data: {', start)
    if data_pos < 0:
        return
    opening = data_pos + len('data: ')
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
                p.write_text(text[:data_pos] + 'data: omitUndefined(' + text[data_pos + len('data: '):i + 1] + ')' + text[i + 1:])
                return
    raise RuntimeError(f'Unbalanced data object for {anchor}')

# SEO create payload.
wrap_data_after('src/modules/property/infrastructure/persistence/prisma-property-extras.repository.ts', 'propertySeo.create({')

# Lifecycle controller actor helper is required to return a fully valid ActorContext.
p = Path('src/modules/property/presentation/property-lifecycle.controller.ts')
text = p.read_text()
if 'ForbiddenException' not in text:
    text = text.replace('  Headers,\n', '  ForbiddenException,\n  Headers,\n', 1)
text = re.sub(
    r"const actor = \(\s*request: AuthenticatedRequest,\s*userAgent\?: string,\s*requestId\?: string,\s*\) => \(\{\s*actorUuid: request\.user\?\.sub,\s*ipAddress: request\.ip,\s*userAgent,\s*requestId,\s*\}\);",
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
)
p.write_text(text)

# Listing create paymentOptions: exact source form seen in CI.
p = Path('src/modules/property/listing/infrastructure/listing.repository.ts')
text = p.read_text()
text = text.replace(
"""              paymentOptions: input.payments?.length
                ? {
                    create: input.payments.map((payment) => ({
""",
"""              ...(input.payments?.length
                ? {
                    paymentOptions: {
                      create: Array.from(input.payments, (payment) => ({
""",
1,
)
text = text.replace(
"""                    })),
                  }
                : undefined,
              analytics:""",
"""                    })),
                    },
                  }
                : {}),
              analytics:""",
1,
)
# Update-many patch: exact object assignment.
text = re.sub(
    r"(const data: Prisma\.PropertyListingUpdateManyMutationInput = )\{(.*?\n\s*)\};",
    r"\1omitUndefined({\2});",
    text,
    count=1,
    flags=re.MULTILINE | re.DOTALL,
)
# Duplicate payment options.
text = text.replace(
"""              paymentOptions: source.paymentOptions.length
                ? {
                    create: source.paymentOptions.map((payment) => ({
""",
"""              ...(source.paymentOptions.length
                ? {
                    paymentOptions: {
                      create: Array.from(source.paymentOptions, (payment) => ({
""",
1,
)
text = text.replace(
"""                    })),
                  }
                : undefined,
              analytics:""",
"""                    })),
                    },
                  }
                : {}),
              analytics:""",
1,
)
# Selector engagement relation.
text = re.sub(
    r"(?ms)^\s*engagements: engagementUserUuid\s*\?\s*\{\s*where: \{ userUuid: engagementUserUuid \},\s*select: \{ isSaved: true, viewedAt: true \},\s*\}\s*: undefined,",
    """        ...(engagementUserUuid
          ? {
              engagements: {
                where: { userUuid: engagementUserUuid },
                select: { isSaved: true, viewedAt: true },
              },
            }
          : {}),""",
    text,
    count=1,
)
p.write_text(text)
