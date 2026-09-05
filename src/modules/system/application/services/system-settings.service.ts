import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SECURITY_AUDIT_REPOSITORY } from '../../../../common/audit/security-audit.port.js';
import type { SecurityAuditRepository } from '../../../../common/audit/security-audit.port.js';
import { SYSTEM_ACTIVITY_REPOSITORY } from '../../domain/repositories/system-activity.repository.js';
import type { SystemActivityRepository } from '../../domain/repositories/system-activity.repository.js';
import { SYSTEM_SETTINGS_REPOSITORY } from '../../domain/repositories/system-settings.repository.js';
import type { SystemSettingsRepository } from '../../domain/repositories/system-settings.repository.js';
import type { SystemSettingsContract } from '../../domain/system-public.contracts.js';
import { SYSTEM_ERROR_CODES } from '../../domain/system-error.codes.js';
import {
  SETTING_DEFAULTS,
  settingDefinition,
  parseSettingValue,
} from '../../domain/settings.registry.js';
import {
  SystemSettingConflictError,
  SystemSettingImmutableError,
} from '../../domain/errors/system.errors.js';
import {
  SYSTEM_CACHE,
  type SystemCachePort,
} from '../cache/system-cache.port.js';

const SETTINGS_CACHE_TTL_MS = 30_000;

@Injectable()
export class SystemSettingsService implements SystemSettingsContract {
  constructor(
    @Inject(SYSTEM_SETTINGS_REPOSITORY)
    private readonly repository: SystemSettingsRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
    @Inject(SYSTEM_ACTIVITY_REPOSITORY)
    private readonly activity: SystemActivityRepository,
    @Inject(SYSTEM_CACHE)
    private readonly cache: SystemCachePort,
  ) {}

  async list(page: number, limit: number) {
    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const safeLimit = Math.min(
      Math.max(Number.isInteger(limit) ? limit : 25, 1),
      100,
    );
    const result = await this.repository.list(
      'GLOBAL',
      'global',
      safePage,
      safeLimit,
    );
    const items = result.items.map((item) => ({
      ...item,
      value: this.deserialize(item.valueType, item.value),
    }));
    return {
      items,
      meta: {
        page: safePage,
        limit: safeLimit,
        total: result.total,
        totalPages: Math.ceil(result.total / safeLimit),
      },
    };
  }

  async get(key: string) {
    const normalizedKey = key.trim();
    const definition = settingDefinition(normalizedKey);
    if (!definition) {
      throw new NotFoundException({
        code: SYSTEM_ERROR_CODES.SETTING_NOT_FOUND,
        message: 'Unknown system setting.',
      });
    }

    const cacheKey = `system:settings:${normalizedKey}`;
    try {
      const cached = await this.cache.get<{
        key: string;
        scope: 'GLOBAL';
        scopeKey: 'global';
        valueType: string;
        value: string | number | boolean;
        version?: number;
        updatedAt?: Date | string;
      }>(cacheKey);
      if (cached) return cached;
    } catch {
      // Cache is an optimization; the database remains authoritative.
    }

    const stored = await this.repository.get(normalizedKey, 'GLOBAL', 'global');
    if (!stored && !(normalizedKey in SETTING_DEFAULTS)) {
      throw new NotFoundException({
        code: SYSTEM_ERROR_CODES.SETTING_NOT_FOUND,
        message: 'System setting not found.',
      });
    }
    const raw = stored?.value ?? SETTING_DEFAULTS[normalizedKey];
    const result = {
      key: normalizedKey,
      scope: 'GLOBAL' as const,
      scopeKey: 'global' as const,
      valueType: definition.valueType,
      value: this.deserialize(definition.valueType, raw),
      ...(stored
        ? { version: stored.version, updatedAt: stored.updatedAt }
        : {}),
    };
    try {
      await this.cache.set(cacheKey, result, SETTINGS_CACHE_TTL_MS);
    } catch {
      // Preserve correctness when cache backend is unavailable.
    }
    return result;
  }

  async update(
    key: string,
    rawValue: string,
    actorUuid: string,
    expectedVersion?: number,
  ) {
    const normalizedKey = key.trim();
    const definition = settingDefinition(normalizedKey);
    if (!definition) {
      throw new NotFoundException({
        code: SYSTEM_ERROR_CODES.SETTING_NOT_FOUND,
        message: 'Unknown system setting.',
      });
    }
    if (!definition.mutable) {
      throw new BadRequestException({
        code: SYSTEM_ERROR_CODES.SETTING_IMMUTABLE,
        message: 'System setting is immutable.',
      });
    }
    let value: string;
    try {
      value = parseSettingValue(definition, rawValue);
    } catch (error: unknown) {
      throw new BadRequestException({
        code: SYSTEM_ERROR_CODES.SETTING_INVALID,
        message:
          error instanceof Error ? error.message : 'Invalid setting value.',
      });
    }
    let result;
    try {
      result = await this.repository.upsert({
        key: normalizedKey,
        scope: definition.scope,
        scopeKey: 'global',
        valueType: definition.valueType,
        value,
        mutable: definition.mutable,
        expectedVersion,
      });
    } catch (error: unknown) {
      if (error instanceof SystemSettingConflictError) {
        throw new ConflictException({
          code: SYSTEM_ERROR_CODES.SETTING_CONFLICT,
          message: error.message,
        });
      }
      if (error instanceof SystemSettingImmutableError) {
        throw new BadRequestException({
          code: SYSTEM_ERROR_CODES.SETTING_IMMUTABLE,
          message: error.message,
        });
      }
      throw error;
    }

    try {
      await this.cache.delete(`system:settings:${normalizedKey}`);
    } catch {
      // Stale cache cannot override the authoritative database value.
    }

    await this.audit.record({
      action: 'SYSTEM_SETTING_UPDATED',
      actorUuid,
      entityType: 'system_setting',
      entityUuid: result.uuid,
      result: 'SUCCESS',
      reason: `key=${normalizedKey};version=${result.version}`,
      changes: [
        {
          field: 'value',
          oldValue: '[REDACTED]',
          newValue: '[REDACTED]',
        },
      ],
    });
    await this.activity.append({
      actorUuid,
      eventType: 'SYSTEM_SETTING_UPDATED',
      category: 'SETTINGS',
      resourceType: 'system_setting',
      resourceUuid: result.uuid,
      summary: `Updated ${normalizedKey}`,
      metadata: { key: normalizedKey, version: result.version },
      requestId: null,
    });
    return {
      key: result.key,
      value: this.deserialize(result.valueType, result.value),
      version: result.version,
      updatedAt: result.updatedAt,
    };
  }

  private deserialize(
    valueType: string,
    value: string | undefined,
  ): string | number | boolean {
    if (value === undefined) {
      throw new NotFoundException({
        code: SYSTEM_ERROR_CODES.SETTING_NOT_FOUND,
        message: 'System setting value is not configured.',
      });
    }
    if (valueType === 'BOOLEAN') return value === 'true';
    if (valueType === 'INTEGER') return Number(value);
    return value;
  }
}
