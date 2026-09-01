import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const controllerPath = 'src/modules/crm/presentation/crm.controller.ts';

const normalize = (value: string) => value.replace(/\s+/g, '');

describe('CRM OpenAPI response metadata', () => {
  it('documents a success response for every CRM controller route', async () => {
    const source = await readFile(controllerPath, 'utf8');
    const lines = source.split(/\r?\n/);
    const routeIndexes = lines.reduce<number[]>((indexes, line, index) => {
      if (/^\s*@(Get|Post|Patch|Delete)\b/.test(line)) indexes.push(index);
      return indexes;
    }, []);

    expect(routeIndexes.length).toBeGreaterThan(0);

    for (const [position, index] of routeIndexes.entries()) {
      const nextIndex = routeIndexes[position + 1] ?? lines.length;
      const method = lines[index].match(/@(Get|Post|Patch|Delete)\b/)?.[1];
      const expectedStatus = method === 'Post' ? '201' : '200';
      const previous = lines.slice(Math.max(0, index - 1), index).join('\n');
      const block = lines.slice(index, nextIndex).join('\n');
      const normalizedPrevious = normalize(previous);
      const normalizedBlock = normalize(block);

      const hasSharedSuccessResponse = normalizedPrevious.includes(
        `@crmSuccessResponse(${expectedStatus})`,
      );
      const hasExplicitSuccessSchema =
        normalizedBlock.includes(`status:${expectedStatus}`) &&
        normalizedBlock.includes('schema:');

      expect(
        hasSharedSuccessResponse || hasExplicitSuccessSchema,
        `${method} route at line ${index + 1} is missing success response schema`,
      ).toBe(true);
    }
  });
});
