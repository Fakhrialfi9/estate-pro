from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        return
    p.write_text(text.replace(old, new, 1))


# SEO: the normalized patch intentionally contains optional fields. Remove
# undefined keys at the Prisma boundary rather than weakening strict typing.
replace(
    'src/modules/property/infrastructure/persistence/prisma-property-extras.repository.ts',
    """        const r = c
          ? await tx.propertySeo.update({ where: { id: c.id }, data })
          : await tx.propertySeo.create({
              data: {
                uuid: randomUUID(),
                propertyId: prop.id,
                createdBy: sid(a),
                ...data,
              },
            });""",
    """        const r = c
          ? await tx.propertySeo.update({
              where: { id: c.id },
              data: omitUndefined(data),
            })
          : await tx.propertySeo.create({
              data: omitUndefined({
                uuid: randomUUID(),
                propertyId: prop.id,
                createdBy: sid(a),
                ...data,
              }),
            });""",
)

# Listing create: optional nested relations must be conditionally present.
replace(
    'src/modules/property/listing/infrastructure/listing.repository.ts',
    """              paymentOptions: input.payments?.length
                ? {
                    create: input.payments.map((payment) => ({""",
    """              ...(input.payments?.length
                ? {
                    paymentOptions: {
                      create: Array.from(input.payments, (payment) => ({""",
)
replace(
    'src/modules/property/listing/infrastructure/listing.repository.ts',
    """                  }
                : undefined,
              analytics: { create: {} },""",
    """                    },
                  }
                : {}),
              analytics: { create: {} },""",
)

# Listing updateMany: the object is patch-shaped, so omit optional undefined
# keys before passing it to Prisma.
replace(
    'src/modules/property/listing/infrastructure/listing.repository.ts',
    '          const data: Prisma.PropertyListingUpdateManyMutationInput = {',
    '          const data: Prisma.PropertyListingUpdateManyMutationInput = omitUndefined({',
)
replace(
    'src/modules/property/listing/infrastructure/listing.repository.ts',
    """            version: { increment: 1 },
          });
          if (to === 'PUBLISHED')""",
    """            version: { increment: 1 },
          });
          if (to === 'PUBLISHED')""",
)
# The opening replacement above requires the original close `};` to become
# `});`; perform this narrowly inside the transition block.
p = Path('src/modules/property/listing/infrastructure/listing.repository.ts')
text = p.read_text()
start = text.find('          const data: Prisma.PropertyListingUpdateManyMutationInput = omitUndefined({')
if start >= 0:
    close = text.find("          if (to === 'PUBLISHED')", start)
    if close >= 0:
        block = text[start:close]
        if '          };' in block:
            block = block.replace('          };', '          });', 1)
            text = text[:start] + block + text[close:]
            p.write_text(text)

# Listing duplicate: same optional payment relation treatment.
replace(
    'src/modules/property/listing/infrastructure/listing.repository.ts',
    """              paymentOptions: source.paymentOptions.length
                ? {
                    create: source.paymentOptions.map((payment) => ({""",
    """              ...(source.paymentOptions.length
                ? {
                    paymentOptions: {
                      create: Array.from(source.paymentOptions, (payment) => ({""",
)
replace(
    'src/modules/property/listing/infrastructure/listing.repository.ts',
    """                  }
                : undefined,
              analytics: { create: {} },""",
    """                    },
                  }
                : {}),
              analytics: { create: {} },""",
)

# Listing response selector: optional engagement selection must be conditionally included.
replace(
    'src/modules/property/listing/infrastructure/listing.repository.ts',
    """            engagements: viewerUserUuid
              ? {
                  where: { userUuid: viewerUserUuid },
                  select: { isSaved: true, viewedAt: true },
                }
              : undefined,""",
    """            ...(viewerUserUuid
              ? {
                  engagements: {
                    where: { userUuid: viewerUserUuid },
                    select: { isSaved: true, viewedAt: true },
                  },
                }
              : {}),""",
)
