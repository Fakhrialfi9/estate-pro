from pathlib import Path
import re


def wrap_first_data_after(path: str, anchor: str) -> None:
    p = Path(path)
    text = p.read_text()
    start = text.find(anchor)
    if start < 0:
        return
    data = text.find('data: {', start)
    if data < 0:
        return
    opening = data + len('data: ')
    depth = 0
    quote = None
    escaped = False
    closing = -1
    for i in range(opening, len(text)):
        c = text[i]
        if quote:
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
    p.write_text(text[:data] + 'data: omitUndefined(' + text[data + len('data: '):closing + 1] + ')' + text[closing + 1:])

# SEO create object.
wrap_first_data_after(
    'src/modules/property/infrastructure/persistence/prisma-property-extras.repository.ts',
    'propertySeo.create({',
)

# Listing transition update data.
p = Path('src/modules/property/listing/infrastructure/listing.repository.ts')
text = p.read_text()
text = text.replace(
    'const data: Prisma.PropertyListingUpdateManyMutationInput = {',
    'const data: Prisma.PropertyListingUpdateManyMutationInput = omitUndefined({',
    1,
)
# Close only the transition data object at the following `version` line.
text = re.sub(
    r"(const data: Prisma\.PropertyListingUpdateManyMutationInput = omitUndefined\(\{.*?version: \{ increment: 1 \},\n)\s*\};",
    r"\1          });",
    text,
    count=1,
    flags=re.MULTILINE | re.DOTALL,
)
# Conditional engagement selector; explicit undefined is invalid with exactOptionalPropertyTypes.
text = re.sub(
    r"(?ms)^(\s*)engagements: engagementUserUuid\s*\?\s*\{.*?^\1  : undefined,",
    r"\1...(engagementUserUuid\n\1  ? {\n\1      engagements: {\n\1        where: { userUuid: engagementUserUuid },\n\1        select: { isSaved: true, viewedAt: true },\n\1      },\n\1    }\n\1  : {}),",
    text,
    count=1,
)
p.write_text(text)
