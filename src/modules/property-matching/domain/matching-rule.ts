export const MATCHING_RULE_WEIGHT_KEYS = [
  'transactionType',
  'propertyType',
  'propertyCategory',
  'budget',
  'location',
  'bedrooms',
  'bathrooms',
  'areaSqm',
  'parkingSpaces',
  'furnishedStatus',
  'condition',
  'behavior',
] as const;

export type MatchingRuleWeightKey = (typeof MATCHING_RULE_WEIGHT_KEYS)[number];

export type MatchingRuleWeights = Readonly<
  Partial<Record<MatchingRuleWeightKey, number>>
>;

export type MatchingRuleRecord = {
  readonly uuid: string;
  readonly name: string;
  readonly version: number;
  readonly weights: MatchingRuleWeights;
  readonly hardCriteria: readonly string[];
  readonly minimumScore: number;
  readonly isActive: boolean;
  readonly createdBy: string;
  readonly activatedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export const DEFAULT_MATCHING_RULE: MatchingRuleWeights = {
  transactionType: 30,
  propertyType: 15,
  propertyCategory: 10,
  budget: 20,
  location: 15,
  bedrooms: 5,
  bathrooms: 5,
  areaSqm: 5,
  parkingSpaces: 5,
  furnishedStatus: 5,
  condition: 5,
  behavior: 10,
};

export const DEFAULT_MATCHING_HARD_CRITERIA = [
  'transactionType',
  'propertyType',
  'propertyCategory',
  'location',
  'budget',
] as const;
