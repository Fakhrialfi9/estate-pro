import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { SystemImportMappingService } from '../../src/modules/system/application/services/system-import-mapping.service.js';

describe('SystemImportMappingService', () => {
  const service = new SystemImportMappingService();

  it('discovers deterministic source columns', () => {
    expect(service.discoverColumns([{ b: 1, a: 2 }, { c: 3, a: 4 }])).toEqual(['a', 'b', 'c']);
  });

  it('rejects duplicate targets', () => {
    expect(() => service.validateColumnMapping([
      { sourceColumn: 'a', targetField: 'summary' },
      { sourceColumn: 'b', targetField: 'summary' },
    ], ['a', 'b'])).toThrow(BadRequestException);
  });

  it('applies finite transforms without dynamic execution', () => {
    expect(service.applyFieldMapping(
      { summary: '  MIXED  ' },
      [{ targetField: 'summary', transforms: ['trim', 'lowercase'] }],
    )).toEqual({ summary: 'mixed' });
  });
});
