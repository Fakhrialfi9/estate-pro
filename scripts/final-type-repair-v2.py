from pathlib import Path
import re


def replace(path: str, old: str, new: str, count: int = -1) -> None:
    p = Path(path)
    text = p.read_text()
    updated = text.replace(old, new, count)
    if updated != text:
        p.write_text(updated)

# Application service: slug may be omitted because the repository derives it.
replace(
    'src/modules/property/application/property-master.service.ts',
    '      typeUuid: string;\n      code: string;\n      name: string;\n      slug: string;',
    '      typeUuid: string;\n      code: string;\n      name: string;\n      slug?: string;',
    1,
)
replace(
    'src/modules/property/application/property-master.service.ts',
    '      categoryUuid: string;\n      code: string;\n      name: string;\n      slug: string;',
    '      categoryUuid: string;\n      code: string;\n      name: string;\n      slug?: string;',
    1,
)
replace(
    'src/modules/property/application/property-master.service.ts',
    '      code: string;\n      name: string;\n      slug: string;\n      category: FacilityCategory;',
    '      code: string;\n      name: string;\n      slug?: string;\n      category: FacilityCategory;',
    1,
)

# Lifecycle controller: actorUuid is required for protected operations.
p = Path('src/modules/property/presentation/property-lifecycle.controller.ts')
text = p.read_text()
if 'ForbiddenException' not in text.split("from '@nestjs/common';")[0]:
    text = text.replace('  Headers,\n', '  ForbiddenException,\n  Headers,\n', 1)
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

# Listing create: optional relations are conditionally included; Prisma receives
# mutable arrays rather than readonly DTO arrays.
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

# Listing update-many: explicit undefined is not valid with exactOptionalPropertyTypes.
text = text.replace(
'          const data: Prisma.PropertyListingUpdateManyMutationInput = {',
'          const data: Prisma.PropertyListingUpdateManyMutationInput = omitUndefined({',
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

# Duplicate listing: conditional payment relation and mutable array.
text = text.replace(
"""              paymentOptions: source.paymentOptions.length
                ? {
                    create: source.paymentOptions.map((payment) => ({""",
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

# Listing selector: optional engagement relation must be conditionally present.
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
# A readonly payment array can also come from the duplicate source.
text = text.replace(
    'create: source.paymentOptions.map((payment) => ({',
    'create: Array.from(source.paymentOptions, (payment) => ({',
    1,
)
p.write_text(text)
