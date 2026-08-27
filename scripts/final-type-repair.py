from pathlib import Path
import re


def replace(path: str, old: str, new: str, count: int | None = None) -> None:
    p = Path(path)
    text = p.read_text()
    text = text.replace(old, new) if count is None else text.replace(old, new, count)
    p.write_text(text)


def matching_brace(text: str, opening: int) -> int:
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
                return i
    raise RuntimeError('unbalanced object literal')


def wrap_first_data_after(path: str, anchor: str) -> None:
    p = Path(path)
    text = p.read_text()
    anchor_pos = text.find(anchor)
    if anchor_pos < 0:
        return
    data_pos = text.find('data: {', anchor_pos)
    if data_pos < 0:
        return
    opening = data_pos + len('data: ')
    closing = matching_brace(text, opening)
    p.write_text(
        text[:data_pos]
        + 'data: omitUndefined('
        + text[data_pos + len('data: '):closing + 1]
        + ')'
        + text[closing + 1:]
    )

# Service contracts: slug is derived from name when omitted.
p = Path('src/modules/property/application/property-master.service.ts')
text = p.read_text()
text = text.replace(
    '      typeUuid: string;\n      code: string;\n      name: string;\n      slug: string;',
    '      typeUuid: string;\n      code: string;\n      name: string;\n      slug?: string;',
    1,
)
text = text.replace(
    '      categoryUuid: string;\n      code: string;\n      name: string;\n      slug: string;',
    '      categoryUuid: string;\n      code: string;\n      name: string;\n      slug?: string;',
    1,
)
text = text.replace(
    '      code: string;\n      name: string;\n      slug: string;\n      category: FacilityCategory;',
    '      code: string;\n      name: string;\n      slug?: string;\n      category: FacilityCategory;',
    1,
)
p.write_text(text)

# Lifecycle controller: fail closed if authentication context is absent.
p = Path('src/modules/property/presentation/property-lifecycle.controller.ts')
text = p.read_text()
text = text.replace(
    '  Headers,\n',
    '  ForbiddenException,\n  Headers,\n',
    1,
)
text = text.replace(
"""const actor = (
  request: AuthenticatedRequest,
  userAgent?: string,
  requestId?: string,
) => ({
  actorUuid: request.user?.sub,
  ipAddress: request.ip,
  userAgent,
  requestId,
});""",
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
1,
)
p.write_text(text)

# Listing repository: conditionally include optional nested relations and use mutable arrays.
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
                : {}),""",
1,
)
text = text.replace(
"""              paymentOptions: input.payments?.length
                ? {
                    create: input.payments.map((payment) => ({""",
"""              ...(input.payments?.length
                ? {
                    paymentOptions: {
                      create: Array.from(input.payments, (payment) => ({""",
1,
)
# Close the conditional payment relation created above.
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
"""          const data: Prisma.PropertyListingUpdateManyMutationInput = {
""",
"""          const data: Prisma.PropertyListingUpdateManyMutationInput = omitUndefined({
""",
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
# Duplicate listing optional price/payment relations.
text = text.replace(
"""              price: source.price
                ? {
                    create: {""",
"""              ...(source.price
                ? {
                    price: {
                      create: {""",
1,
)
text = text.replace(
"""                  }
                : undefined,
              paymentOptions: source.paymentOptions.length
                ? {
                    create: source.paymentOptions.map((payment) => ({""",
"""                    },
                  }
                : {}),
              ...(source.paymentOptions.length
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
# Engagement selector.
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
# Location selectors.
for key, name in (('country', 'countryUuid'), ('province', 'provinceUuid'), ('city', 'cityUuid'), ('district', 'districtUuid')):
    text = text.replace(
        f'          {key}: query.{name} ? {{ is: {{ uuid: query.{name} }} }} : undefined,',
        f'          ...({{ {key}: query.{name} ? {{ is: {{ uuid: query.{name} }} }} : undefined }}),',
    )
    text = text.replace(
        f'          {key}: query.{name}\n            ? {{ is: {{ uuid: query.{name} }} }}\n            : undefined,',
        f'          ...({{ {key}: query.{name} ? {{ is: {{ uuid: query.{name} }} }} : undefined }}),',
    )
# Remove any remaining chained catch that widens return type.
text = re.sub(r'\n\s*\.catch\(\(error: unknown\) => this\.mapError\(error\)\),', ',', text)
p.write_text(text)
