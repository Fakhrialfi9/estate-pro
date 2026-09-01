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

export interface SavedPropertyPort {
  listSavedListings(subjectUuid: string): Promise<readonly unknown[]>;
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
  ): Promise<unknown | null>;
  listRecommendationHistory(
    subjectType: MatchingSubjectType,
    subjectUuid: string,
    page: number,
    limit: number,
  ): Promise<{ items: readonly unknown[]; total: number }>;
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
