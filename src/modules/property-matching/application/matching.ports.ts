import type {
  BehavioralSignal,
  MatchCandidate,
  MatchingSubjectType,
  PropertyPreferenceState,
} from '../domain/matching.types.js';

export const MATCHING_REPOSITORY = Symbol('MATCHING_REPOSITORY');
export const SAVED_PROPERTY_PORT = Symbol('SAVED_PROPERTY_PORT');

export type StoredPreference = PropertyPreferenceState & {
  status: 'ACTIVE' | 'ARCHIVED';
};

export type StoredRecommendation = {
  readonly uuid: string;
  readonly subjectType: MatchingSubjectType;
  readonly subjectUuid: string;
  readonly preferenceVersion: number;
  readonly algorithmVersion: number;
  readonly source: string;
  readonly generatedAt: Date;
  readonly candidateCount: number;
  readonly stale: boolean;
  readonly items: readonly {
    readonly uuid: string;
    readonly propertyUuid: string;
    readonly listingUuid: string;
    readonly rank: number;
    readonly score: number;
    readonly explanation: unknown;
  }[];
};

export type RecommendationHistoryItem = {
  readonly uuid: string;
  readonly recommendationId: string;
  readonly source: string;
  readonly preferenceVersion: number;
  readonly algorithmVersion: number;
  readonly candidateCount: number;
  readonly generatedAt: Date;
  readonly actorUuid: string | null;
};

export type SavedProperty = {
  readonly uuid: string;
  readonly transactionType: string;
  readonly publishedAt: Date | null;
  readonly property: { readonly uuid: string; readonly title: string };
  readonly price: {
    readonly currency: string;
    readonly priceType: string;
    readonly minPrice: unknown;
    readonly maxPrice: unknown;
  } | null;
};

export interface SavedPropertyPort {
  listSavedListings(subjectUuid: string): Promise<readonly SavedProperty[]>;
}

export interface MatchingRepository extends SavedPropertyPort {
  findPreference(
    subjectType: MatchingSubjectType,
    subjectUuid: string,
  ): Promise<StoredPreference | null>;
  createPreference(
    subjectType: MatchingSubjectType,
    subjectUuid: string,
    preference: PropertyPreferenceState,
  ): Promise<StoredPreference>;
  updatePreference(
    subjectType: MatchingSubjectType,
    subjectUuid: string,
    expectedVersion: number,
    preference: PropertyPreferenceState,
  ): Promise<StoredPreference>;
  archivePreference(
    subjectType: MatchingSubjectType,
    subjectUuid: string,
    expectedVersion: number,
  ): Promise<StoredPreference>;
  restorePreference(
    subjectType: MatchingSubjectType,
    subjectUuid: string,
    expectedVersion: number,
    preference: PropertyPreferenceState,
  ): Promise<StoredPreference>;
  listCandidates(filters: {
    preference: PropertyPreferenceState;
    now: Date;
    limit: number;
  }): Promise<readonly MatchCandidate[]>;
  getSignals(
    subjectUuid: string,
    listingUuids: readonly string[],
  ): Promise<ReadonlyMap<string, BehavioralSignal>>;
  saveRecommendation(input: {
    subjectType: MatchingSubjectType;
    subjectUuid: string;
    preferenceVersion: number;
    algorithmVersion: number;
    source: string;
    candidateCount: number;
    items: readonly {
      propertyUuid: string;
      listingUuid: string;
      rank: number;
      score: number;
      explanation: string;
    }[];
    now: Date;
  }): Promise<{ uuid: string; generatedAt: Date; itemCount: number }>;
  getLatestRecommendation(
    subjectType: MatchingSubjectType,
    subjectUuid: string,
  ): Promise<StoredRecommendation | null>;
  listRecommendationHistory(
    subjectType: MatchingSubjectType,
    subjectUuid: string,
    page: number,
    limit: number,
  ): Promise<{ items: readonly RecommendationHistoryItem[]; total: number }>;
  recordFeedback(input: {
    recommendationItemUuid: string;
    subjectType: MatchingSubjectType;
    subjectUuid: string;
    propertyUuid: string;
    listingUuid: string;
    feedback: string;
  }): Promise<unknown>;
  getPreferenceSubjectScope(
    subjectType: MatchingSubjectType,
    subjectUuid: string,
  ): Promise<{ uuid: string; ownerUserUuid: string | null } | null>;
}
