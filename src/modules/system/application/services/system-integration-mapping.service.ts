import { Injectable } from '@nestjs/common';

export type MappingTransform = 'string' | 'number' | 'boolean' | 'date';

type MappingRule = Readonly<{
  from?: string;
  default?: unknown;
  transform?: MappingTransform;
  omitIfNull?: boolean;
}>;

const MAX_RULES = 100;
const PATH_PATTERN = /^(?!.*(?:^|\.)(__proto__|prototype|constructor)(?:\.|$))[A-Za-z0-9_$-]+(?:\.[A-Za-z0-9_$-]+)*$/;

@Injectable()
export class SystemIntegrationMappingService {
  map(
    source: Record<string, unknown>,
    configuration: Record<string, unknown>,
  ): Record<string, unknown> {
    const fields = this.rules(configuration);
    if (fields.length === 0) return structuredClone(source);
    if (fields.length > MAX_RULES)
      throw new Error('Integration mapping contains too many rules');

    const output: Record<string, unknown> = {};
    for (const [target, rule] of fields) {
      this.assertPath(target);
      const sourceValue =
        rule.from === undefined ? undefined : this.read(source, rule.from);
      const selected =
        sourceValue === undefined ? structuredClone(rule.default) : sourceValue;
      if (selected === null && rule.omitIfNull) continue;
      this.write(output, target, this.transform(selected, rule.transform));
    }
    return output;
  }

  validate(configuration: Record<string, unknown>): void {
    for (const [target, rule] of this.rules(configuration)) {
      this.assertPath(target);
      if (rule.from !== undefined) this.assertPath(rule.from);
      if (rule.transform && !['string', 'number', 'boolean', 'date'].includes(rule.transform))
        throw new Error(`Unsupported integration mapping transform: ${String(rule.transform)}`);
    }
  }

  private rules(
    configuration: Record<string, unknown>,
  ): readonly [string, MappingRule][] {
    const raw =
      configuration.fields && typeof configuration.fields === 'object'
        ? configuration.fields
        : configuration;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];

    return Object.entries(raw).map(([target, value]) => {
      if (typeof value === 'string') return [target, { from: value }] as const;
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error(`Invalid integration mapping rule: ${target}`);
      const rule = value as Record<string, unknown>;
      if (rule.from !== undefined && typeof rule.from !== 'string')
        throw new Error(`Invalid integration mapping source: ${target}`);
      if (
        rule.transform !== undefined &&
        typeof rule.transform !== 'string'
      )
        throw new Error(`Invalid integration mapping transform: ${target}`);
      if (
        rule.omitIfNull !== undefined &&
        typeof rule.omitIfNull !== 'boolean'
      )
        throw new Error(`Invalid integration mapping omitIfNull: ${target}`);
      return [
        target,
        {
          from: rule.from as string | undefined,
          default: rule.default,
          transform: rule.transform as MappingTransform | undefined,
          omitIfNull: rule.omitIfNull as boolean | undefined,
        },
      ] as const;
    });
  }

  private transform(value: unknown, transform?: MappingTransform) {
    if (value === undefined || transform === undefined) return value;
    switch (transform) {
      case 'string':
        return typeof value === 'string' ? value : String(value);
      case 'number': {
        const result = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(result)) throw new Error('Integration mapping produced an invalid number');
        return result;
      }
      case 'boolean':
        if (typeof value === 'boolean') return value;
        if (value === 'true' || value === '1' || value === 1) return true;
        if (value === 'false' || value === '0' || value === 0) return false;
        throw new Error('Integration mapping produced an invalid boolean');
      case 'date':
        if (value instanceof Date) return value.toISOString();
        const date = new Date(String(value));
        if (!Number.isFinite(date.getTime())) throw new Error('Integration mapping produced an invalid date');
        return date.toISOString();
    }
  }

  private read(source: Record<string, unknown>, path: string) {
    this.assertPath(path);
    let current: unknown = source;
    for (const segment of path.split('.')) {
      if (!current || typeof current !== 'object' || Array.isArray(current))
        return undefined;
      current = (current as Record<string, unknown>)[segment];
    }
    return current;
  }

  private write(target: Record<string, unknown>, path: string, value: unknown) {
    let current = target;
    const parts = path.split('.');
    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index]!;
      const existing = current[part];
      if (!existing || typeof existing !== 'object' || Array.isArray(existing))
        current[part] = {};
      current = current[part] as Record<string, unknown>;
    }
    current[parts.at(-1)!] = value;
  }

  private assertPath(path: string) {
    if (!PATH_PATTERN.test(path) || path.length > 220)
      throw new Error('Invalid integration mapping path');
  }
}
