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
        raise RuntimeError(f'Unbalanced object at {path}: {anchor}')
    # Idempotent: if this data property is already wrapped, the next search
    # does not find `data: {` and therefore leaves it untouched.
    p.write_text(
        text[:data_pos]
        + 'data: omitUndefined('
        + text[data_pos + len('data: '):closing + 1]
        + ')'
        + text[closing + 1:]
    )


# ---------------------------------------------------------------------------
# 1) SEO create payload: optional JSON fields must be omitted, not assigned
#    undefined, because the project intentionally enables
#    exactOptionalPropertyTypes.
# ---------------------------------------------------------------------------
wrap_data_after(
    'src/modules/property/infrastructure/persistence/prisma-property-extras.repository.ts',
    'propertySeo.create({',
)

# ---------------------------------------------------------------------------
# 2) Listing create: paymentOptions is an optional nested relation. Build it
#    with conditional spread instead of `: undefined`.
# ---------------------------------------------------------------------------
p = Path('src/modules/property/listing/infrastructure/listing.repository.ts')
text = p.read_text()
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

# ---------------------------------------------------------------------------
# 3) Listing transition update: construct updateMany data without undefined
#    optional values.
# ---------------------------------------------------------------------------
pattern = re.compile(
    r"(const data: Prisma\.PropertyListingUpdateManyMutationInput = )\{(?P<body>.*?\n\s*)\};",
    re.MULTILINE | re.DOTALL,
)
match = pattern.search(text)
if match and not match.group(1).endswith('omitUndefined('):
    text = text[:match.start()] + match.group(1) + 'omitUndefined({' + match.group('body') + '});' + text[match.end():]

# ---------------------------------------------------------------------------
# 4) Listing duplicate: optional paymentOptions relation must be conditional.
# ---------------------------------------------------------------------------
text = text.replace(
"""              paymentOptions: source.paymentOptions.length
                ? {
                    create: Array.from(source.paymentOptions, (payment) => ({""",
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

# ---------------------------------------------------------------------------
# 5) Listing selector: engagement relation is optional and therefore must be
#    absent from the select object when no viewer UUID exists.
# ---------------------------------------------------------------------------
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

# ---------------------------------------------------------------------------
# 6) Lifecycle actor helper: protected endpoints require an authenticated
#    principal; optional metadata is omitted from the returned context.
# ---------------------------------------------------------------------------
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
