import { MIN_SAFE_SCORE } from './matching.types.js';
import type { BudgetPreference, BehavioralSignal, MatchCandidate, MatchExplanation, MatchResult, PropertyPreferenceState } from './matching.types.js';

const clamp = (value: number, min = 0, max = 100): number => Math.min(max, Math.max(min, value));
const decimal = (value: string | null | undefined): number | null => {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const rangeMatch = (value: number | null, range: { min?: number; max?: number } | undefined): boolean => {
  if (range == null) return true;
  if (value == null) return false;
  if (range.min != null && value < range.min) return false;
  if (range.max != null && value > range.max) return false;
  return true;
};
const stringRangeMatch = (value: string | null, range: { min?: string; max?: string } | undefined): boolean => {
  if (range == null) return true;
  const numeric = decimal(value);
  if (numeric == null) return false;
  const min = decimal(range.min);
  const max = decimal(range.max);
  if (min != null && numeric < min) return false;
  if (max != null && numeric > max) return false;
  return true;
};
const locationLevel = (preference: PropertyPreferenceState['location'], candidate: MatchCandidate['location']): number => {
  if (!preference || !candidate) return 0;
  const levels: (keyof NonNullable<PropertyPreferenceState['location']>)[] = ['countryUuid', 'provinceUuid', 'cityUuid', 'districtUuid', 'subdistrictUuid'];
  let matched = 0;
  let requested = 0;
  for (const level of levels) {
    const preferred = preference[level];
    if (preferred == null) continue;
    requested += 1;
    if (candidate[level] !== preferred) return matched / requested;
    matched += 1;
  }
  return requested === 0 ? 0 : matched / requested;
};
const moneyToCents = (value: string | null | undefined): bigint | null => {
  if (value == null || !/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
};
const budgetFit = (preference: BudgetPreference | undefined, candidate: MatchCandidate): boolean => {
  if (!preference) return true;
  if (!candidate.price || candidate.price.currency !== preference.currency || candidate.price.priceType !== preference.frequency) return false;
  const low = moneyToCents(candidate.price.minPrice) ?? moneyToCents(candidate.price.maxPrice);
  const high = moneyToCents(candidate.price.maxPrice) ?? moneyToCents(candidate.price.minPrice);
  if (low == null || high == null) return false;
  const requestedMin = moneyToCents(preference.min);
  const requestedMax = moneyToCents(preference.max);
  if (requestedMin == null && requestedMax == null) return true;
  const tolerance = BigInt(Math.round(clamp(preference.tolerancePercent ?? 0, 0, 100)));
  const effectiveMin = requestedMin == null ? null : (requestedMin * (100n - tolerance)) / 100n;
  const effectiveMax = requestedMax == null ? null : (requestedMax * (100n + tolerance)) / 100n;
  if (effectiveMax != null && low > effectiveMax) return false;
  if (effectiveMin != null && high < effectiveMin) return false;
  return true;
};
const evaluateHardCriteria = (preference: PropertyPreferenceState, candidate: MatchCandidate): string[] => {
  const failures: string[] = [];
  if (preference.hardCriteria.includes('transactionType') && !preference.transactionTypes.includes(candidate.transactionType)) failures.push('transactionType');
  if (preference.hardCriteria.includes('propertyType') && !preference.propertyTypeUuids.includes(candidate.propertyTypeUuid)) failures.push('propertyType');
  if (preference.hardCriteria.includes('propertyCategory') && !preference.propertyCategoryUuids.includes(candidate.propertyCategoryUuid)) failures.push('propertyCategory');
  if (preference.hardCriteria.includes('location') && locationLevel(preference.location, candidate.location) < 1) failures.push('location');
  if (preference.hardCriteria.includes('budget') && !budgetFit(preference.budget, candidate)) failures.push('budget');
  return failures;
};
const weightedScore = (preference: PropertyPreferenceState, candidate: MatchCandidate, signal: BehavioralSignal): { score: number; explanation: MatchExplanation } => {
  const contributions: { criterion: string; points: number }[] = [];
  const matched: string[] = [];
  const missed: string[] = [];
  const penalties: string[] = [];
  const add = (criterion: string, points: number, ok: boolean): void => {
    contributions.push({ criterion, points: ok ? points : 0 });
    (ok ? matched : missed).push(criterion);
  };
  let possible = 0;
  let earned = 0;
  const hard = new Set(preference.hardCriteria);
  if (preference.transactionTypes.length > 0 && !hard.has('transactionType')) {
    possible += 30;
    const points = preference.transactionTypes.includes(candidate.transactionType) ? 30 : 0;
    earned += points;
    add('transactionType', points, points > 0);
  }
  if (preference.propertyTypeUuids.length > 0 && !hard.has('propertyType')) {
    possible += 15;
    const points = preference.propertyTypeUuids.includes(candidate.propertyTypeUuid) ? 15 : 0;
    earned += points;
    add('propertyType', points, points > 0);
  }
  if (preference.propertyCategoryUuids.length > 0 && !hard.has('propertyCategory')) {
    possible += 10;
    const points = preference.propertyCategoryUuids.includes(candidate.propertyCategoryUuid) ? 10 : 0;
    earned += points;
    add('propertyCategory', points, points > 0);
  }
  if (preference.budget && !hard.has('budget')) {
    possible += 20;
    const points = budgetFit(preference.budget, candidate) ? 20 : 0;
    earned += points;
    add('budget', points, points > 0);
    if (!points) penalties.push('budget_mismatch');
  }
  if (preference.location && !hard.has('location')) {
    possible += 15;
    const ratio = locationLevel(preference.location, candidate.location);
    const points = Math.round(ratio * 15);
    earned += points;
    add('location', points, points > 0);
  }
  const specification = preference.specification;
  const candidateSpecification = candidate.specification;
  if (specification?.bedrooms) {
    possible += 5;
    const points = rangeMatch(candidateSpecification?.bedrooms ?? null, specification.bedrooms) ? 5 : 0;
    earned += points;
    add('bedrooms', points, points > 0);
  }
  if (specification?.bathrooms) {
    possible += 5;
    const points = stringRangeMatch(candidateSpecification?.bathrooms ?? null, specification.bathrooms) ? 5 : 0;
    earned += points;
    add('bathrooms', points, points > 0);
  }
  if (specification?.areaSqm) {
    possible += 5;
    const points = stringRangeMatch(candidateSpecification?.buildingAreaSqm ?? null, specification.areaSqm) ? 5 : 0;
    earned += points;
    add('areaSqm', points, points > 0);
  }
  if (specification?.parkingSpaces) {
    possible += 5;
    const points = rangeMatch(candidateSpecification?.parkingSpaces ?? null, specification.parkingSpaces) ? 5 : 0;
    earned += points;
    add('parkingSpaces', points, points > 0);
  }
  if (specification?.furnishedStatus) {
    possible += 5;
    const points = candidateSpecification?.furnishedStatus === specification.furnishedStatus ? 5 : 0;
    earned += points;
    add('furnishedStatus', points, points > 0);
  }
  if (specification?.condition) {
    possible += 5;
    const points = candidateSpecification?.condition === specification.condition ? 5 : 0;
    earned += points;
    add('condition', points, points > 0);
  }
  possible += 10;
  let behavior = 0;
  if (signal.saved) behavior += 4;
  if (signal.viewedAt) behavior += 2;
  if (signal.inquiryCount > 0) behavior += 4;
  else if (signal.viewCount > 0) behavior += 1;
  behavior = Math.min(10, behavior);
  earned += behavior;
  contributions.push({ criterion: 'behavior', points: behavior });
  if (behavior > 0) matched.push('behavior');
  const score = possible === 0 ? 0 : Math.round((earned / possible) * 10000) / 100;
  return { score: clamp(score), explanation: { matched, missed, penalties, contributions } };
};

export class MatchingEngine {
  evaluate(preference: PropertyPreferenceState, candidates: readonly MatchCandidate[], signals: ReadonlyMap<string, BehavioralSignal>): MatchResult[] {
    const candidateByListing = new Map(candidates.map((candidate) => [candidate.listingUuid, candidate]));
    const results: MatchResult[] = [];
    for (const candidate of candidates) {
      if (evaluateHardCriteria(preference, candidate).length > 0) continue;
      const result = weightedScore(preference, candidate, signals.get(candidate.listingUuid) ?? { saved: false, viewedAt: null, inquiryCount: 0, viewCount: 0 });
      if (result.score < MIN_SAFE_SCORE) continue;
      results.push({ propertyUuid: candidate.propertyUuid, listingUuid: candidate.listingUuid, score: result.score, explanation: result.explanation });
    }
    return results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const publishedA = candidateByListing.get(a.listingUuid)?.publishedAt.getTime() ?? 0;
      const publishedB = candidateByListing.get(b.listingUuid)?.publishedAt.getTime() ?? 0;
      if (publishedB !== publishedA) return publishedB - publishedA;
      return a.listingUuid.localeCompare(b.listingUuid);
    });
  }
}