import { BadRequestException, Injectable } from '@nestjs/common';
import {
  IMPORT_TARGET_FIELDS,
  type ImportColumnMapping,
  type ImportFieldMapping,
  type ImportTargetField,
  type ImportTransform,
} from '../../domain/import/import-mapping.contracts.js';

@Injectable()
export class SystemImportMappingService {
  applyColumnMapping(
    row: Readonly<Record<string, unknown>>,
    mapping: readonly ImportColumnMapping[] | undefined,
  ): Record<string, unknown> {
    if (!mapping?.length) return { ...row };
    this.validateColumnMapping(mapping, Object.keys(row));
    const mapped: Record<string, unknown> = {};
    for (const item of mapping) mapped[item.targetField] = row[item.sourceColumn];
    return mapped;
  }

  applyFieldMapping(
    row: Readonly<Record<string, unknown>>,
    mapping: readonly ImportFieldMapping[] | undefined,
  ): Record<string, unknown> {
    if (!mapping?.length) return { ...row };
    const result = { ...row };
    for (const item of mapping) {
      result[item.targetField] = this.applyTransforms(
        result[item.targetField],
        item.transforms,
      );
    }
    return result;
  }

  discoverColumns(
    rows: readonly Readonly<Record<string, unknown>>[],
  ): readonly string[] {
    const columns = new Set<string>();
    for (const row of rows) for (const key of Object.keys(row)) columns.add(key);
    return [...columns].sort();
  }

  validateColumnMapping(
    mapping: readonly ImportColumnMapping[],
    availableColumns: readonly string[],
  ): void {
    const sourceColumns = new Set(availableColumns);
    const targets = new Set<ImportTargetField>();
    for (const item of mapping) {
      if (!sourceColumns.has(item.sourceColumn))
        throw new BadRequestException(`Unknown source column: ${item.sourceColumn}`);
      if (!IMPORT_TARGET_FIELDS.includes(item.targetField))
        throw new BadRequestException(`Forbidden import target: ${item.targetField}`);
      if (targets.has(item.targetField))
        throw new BadRequestException(`Duplicate import target: ${item.targetField}`);
      targets.add(item.targetField);
    }
  }

  validateFieldMapping(mapping: readonly ImportFieldMapping[] | undefined): void {
    if (!mapping) return;
    const targets = new Set<ImportTargetField>();
    const transforms = new Set<ImportTransform>([
      'trim',
      'lowercase',
      'uppercase',
      'null-if-empty',
      'number',
      'boolean',
      'date',
    ]);
    for (const item of mapping) {
      if (!IMPORT_TARGET_FIELDS.includes(item.targetField))
        throw new BadRequestException(`Forbidden import target: ${item.targetField}`);
      if (targets.has(item.targetField))
        throw new BadRequestException(`Duplicate field mapping: ${item.targetField}`);
      targets.add(item.targetField);
      for (const transform of item.transforms) {
        if (!transforms.has(transform))
          throw new BadRequestException(`Unsupported import transform: ${transform}`);
      }
    }
  }

  private applyTransforms(value: unknown, transforms: readonly ImportTransform[]) {
    let current: unknown = value;
    for (const transform of transforms) {
      switch (transform) {
        case 'trim':
          if (typeof current === 'string') current = current.trim();
          break;
        case 'lowercase':
          if (typeof current === 'string') current = current.toLowerCase();
          break;
        case 'uppercase':
          if (typeof current === 'string') current = current.toUpperCase();
          break;
        case 'null-if-empty':
          if (current === '' || (typeof current === 'string' && current.trim() === '')) current = null;
          break;
        case 'number': {
          const parsed = typeof current === 'number' ? current : Number(current);
          if (!Number.isFinite(parsed)) throw new BadRequestException('Invalid numeric import value');
          current = parsed;
          break;
        }
        case 'boolean':
          if (typeof current === 'boolean') break;
          if (current === 'true' || current === 1 || current === '1') current = true;
          else if (current === 'false' || current === 0 || current === '0') current = false;
          else throw new BadRequestException('Invalid boolean import value');
          break;
        case 'date': {
          const date = current instanceof Date ? current : new Date(String(current));
          if (!Number.isFinite(date.getTime())) throw new BadRequestException('Invalid date import value');
          current = date.toISOString();
          break;
        }
      }
    }
    return current;
  }
}
