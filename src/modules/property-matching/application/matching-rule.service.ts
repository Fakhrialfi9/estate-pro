import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SecurityAuditRepository } from '../../../common/audit/security-audit.port.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../common/audit/security-audit.port.js';
import {
  DEFAULT_MATCHING_HARD_CRITERIA,
  DEFAULT_MATCHING_RULE,
  MATCHING_RULE_WEIGHT_KEYS,
  type MatchingRuleWeights,
} from '../domain/matching-rule.js';
import {
  MATCHING_RULE_REPOSITORY,
  type MatchingRuleRepository,
} from '../domain/repositories/matching-rule.repository.js';

const hardCriteria = new Set([
  'transactionType',
  'propertyType',
  'propertyCategory',
  'location',
  'budget',
]);

@Injectable()
export class MatchingRuleService {
  constructor(
    @Inject(MATCHING_RULE_REPOSITORY)
    private readonly repository: MatchingRuleRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {}

  async active() {
    return (await this.repository.getActive()) ?? {
      uuid: 'default',
      name: 'default',
      version: 1,
      weights: DEFAULT_MATCHING_RULE,
      hardCriteria: DEFAULT_MATCHING_HARD_CRITERIA,
      minimumScore: 0,
      isActive: true,
      createdBy: 'system',
      activatedAt: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
  }

  async get(uuid: string) {
    const row = await this.repository.get(uuid);
    if (!row) throw new NotFoundException('Matching rule not found');
    return row;
  }

  list(page = 1, limit = 20) {
    return this.repository.list(page, limit);
  }

  async create(input: {
    name: string;
    version?: number;
    weights?: MatchingRuleWeights;
    hardCriteria?: readonly string[];
    minimumScore?: number;
    createdBy: string;
    activate?: boolean;
  }) {
    const normalized = this.validate(input);
    const result = await this.repository.create(normalized);
    await this.audit.record({
      action: 'PROPERTY_MATCHING_RULE_CREATED',
      actorUuid: input.createdBy,
      entityType: 'matching_rule',
      entityUuid: result.uuid,
      result: 'SUCCESS',
      reason: `version=${result.version};active=${result.isActive}`,
    });
    return result;
  }

  async update(
    uuid: string,
    expectedVersion: number,
    input: {
      name?: string;
      weights?: MatchingRuleWeights;
      hardCriteria?: readonly string[];
      minimumScore?: number;
    },
    actorUuid: string,
  ) {
    const current = await this.repository.get(uuid);
    if (!current) throw new NotFoundException('Matching rule not found');
    if (expectedVersion !== current.version)
      throw new ConflictException('Matching rule version is stale');
    const result = await this.repository.update(uuid, expectedVersion, {
      name: input.name?.trim(),
      weights: input.weights ? this.validateWeights(input.weights) : undefined,
      hardCriteria: input.hardCriteria
        ? this.validateHardCriteria(input.hardCriteria)
        : undefined,
      minimumScore:
        input.minimumScore === undefined
          ? undefined
          : this.validateMinimumScore(input.minimumScore),
    });
    await this.audit.record({
      action: 'PROPERTY_MATCHING_RULE_UPDATED',
      actorUuid,
      entityType: 'matching_rule',
      entityUuid: result.uuid,
      result: 'SUCCESS',
      reason: `version=${result.version}`,
    });
    return result;
  }

  async activate(uuid: string, actorUuid: string) {
    const result = await this.repository.activate(uuid);
    await this.audit.record({
      action: 'PROPERTY_MATCHING_RULE_ACTIVATED',
      actorUuid,
      entityType: 'matching_rule',
      entityUuid: result.uuid,
      result: 'SUCCESS',
      reason: `version=${result.version}`,
    });
    return result;
  }

  private validate(input: {
    name: string;
    version?: number;
    weights?: MatchingRuleWeights;
    hardCriteria?: readonly string[];
    minimumScore?: number;
    createdBy: string;
    activate?: boolean;
  }) {
    const name = input.name.trim();
    if (!/^[A-Za-z0-9_. -]{1,120}$/.test(name))
      throw new BadRequestException('Invalid matching rule name');
    const version = input.version ?? 1;
    if (!Number.isInteger(version) || version < 1 || version > 10000)
      throw new BadRequestException('Invalid matching rule version');
    return {
      name,
      version,
      weights: input.weights ? this.validateWeights(input.weights) : DEFAULT_MATCHING_RULE,
      hardCriteria: input.hardCriteria
        ? this.validateHardCriteria(input.hardCriteria)
        : DEFAULT_MATCHING_HARD_CRITERIA,
      minimumScore:
        input.minimumScore === undefined
          ? 0
          : this.validateMinimumScore(input.minimumScore),
      createdBy: input.createdBy,
      activate: input.activate === true,
    };
  }

  private validateWeights(weights: MatchingRuleWeights): MatchingRuleWeights {
    const output: Record<string, number> = {};
    let total = 0;
    for (const key of MATCHING_RULE_WEIGHT_KEYS) {
      const value = weights[key];
      if (value === undefined) continue;
      if (!Number.isFinite(value) || value < 0 || value > 100)
        throw new BadRequestException(`Invalid weight for ${key}`);
      const normalized = Math.round(value * 100) / 100;
      output[key] = normalized;
      total += normalized;
    }
    if (total <= 0 || total > 100)
      throw new BadRequestException('Matching rule weight sum must be between 0 and 100');
    return output as MatchingRuleWeights;
  }

  private validateHardCriteria(criteria: readonly string[]): readonly string[] {
    const unique = [...new Set(criteria)];
    if (unique.some((value) => !hardCriteria.has(value)))
      throw new BadRequestException('Invalid matching hard criterion');
    return unique;
  }

  private validateMinimumScore(value: number): number {
    if (!Number.isFinite(value) || value < 0 || value > 100)
      throw new BadRequestException('Matching rule minimumScore must be between 0 and 100');
    return Math.round(value * 100) / 100;
  }
}
