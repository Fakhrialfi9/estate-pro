import type {
  MatchingRuleRecord,
  MatchingRuleWeights,
} from '../matching-rule.js';

export const MATCHING_RULE_REPOSITORY = Symbol('MATCHING_RULE_REPOSITORY');

export interface MatchingRuleRepository {
  getActive(): Promise<MatchingRuleRecord | null>;
  get(uuid: string): Promise<MatchingRuleRecord | null>;
  list(page: number, limit: number): Promise<{
    items: readonly MatchingRuleRecord[];
    total: number;
  }>;
  create(input: {
    name: string;
    version: number;
    weights: MatchingRuleWeights;
    hardCriteria: readonly string[];
    minimumScore: number;
    createdBy: string;
    activate: boolean;
  }): Promise<MatchingRuleRecord>;
  update(
    uuid: string,
    expectedVersion: number,
    input: {
      name?: string;
      weights?: MatchingRuleWeights;
      hardCriteria?: readonly string[];
      minimumScore?: number;
    },
  ): Promise<MatchingRuleRecord>;
  activate(uuid: string): Promise<MatchingRuleRecord>;
}
