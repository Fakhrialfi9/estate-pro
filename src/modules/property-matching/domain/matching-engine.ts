import { MIN_SAFE_SCORE } from './matching.types.js';
import type {
  BehavioralSignal,
  MatchCandidate,
  MatchExplanation,
  MatchResult,
  PropertyPreferenceState,
} from './matching.types.js';
import {
  DEFAULT_MATCHING_RULE,
  type MatchingRuleRecord,
  type MatchingRuleWeightKey,
} from './matching-rule.js';

const clamp = (value: number, min = 0, max = 100): number =>
  Math.min(max, Math.max(min, value));
const decimal = (value: string | null | undefined): number | null => {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const rangeMatch = (
  value: number | null,
  range: { min?: number; max?: number } | undefined,
): boolean => {
  if (range == null) return true;
  if (value == null) return false;
  if (range.min != null && value < range.min) return false;
  if (range.max != null && value > range.max) return false;
  return true;
};
const stringRangeMatch = (
  value: string | null,
  range: { min?: string; max?: string } | undefined,
): boolean => {
  if (range == null) return true;
  const numeric = decimal(value);
  if (numeric == null) return false;
  const min = decimal(range.min);
  const max = decimal(range.max);
  if (min != null && numeric < min) return false;
  if (max != null && numeric > max) return false;
  return true;
};

const hierarchyRatio = (
  preference: PropertyPreferenceState['location'],
  candidate: MatchCandidate['location'],
): number => {
  if (!preference || !candidate) return 0;
  const levels: (keyof NonNullable<PropertyPreferenceState['location']>)[] = [
    'countryUuid',
    'provinceUuid',
    'cityUuid',
    'districtUuid',
    'subdistrictUuid',
  ];
  let matched = 0;
  let requested = 0;
  for (const level of levels) {
    const preferred = preference[level];
    if (preferred == null) continue;
    requested += 1;
    if (candidate[level] !== preferred) break;
    matched += 1;
  }
  return requested === 0 ? 0 : matched / requested;
};

const distanceKm = (
  preference: PropertyPreferenceState['location'],
  candidate: MatchCandidate['location'],
): number | null => {
  if (
    !preference?.radiusKm ||
    preference.latitude == null ||
    preference.longitude == null ||
    !candidate ||
    candidate.latitude == null ||
    candidate.longitude == null
  )
    return null;
  const toRadians = (value: number): number => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const lat1 = toRadians(preference.latitude);
  const lat2 = toRadians(candidate.latitude);
  const dLat = toRadians(candidate.latitude - preference.latitude);
  const dLon = toRadians(candidate.longitude - preference.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const locationHardMatch = (
  preference: PropertyPreferenceState['location'],
  candidate: MatchCandidate['location'],
): boolean => {
  if (!preference) return true;
  const hierarchyRequested = [
    preference.countryUuid,
    preference.provinceUuid,
    preference.cityUuid,
    preference.districtUuid,
    preference.subdistrictUuid,
  ].some(Boolean);
  if (hierarchyRequested && hierarchyRatio(preference, candidate) < 1)
    return false;
  if (preference.radiusKm != null) {
    const distance = distanceKm(preference, candidate);
    return distance != null && distance <= preference.radiusKm;
  }
  return hierarchyRequested;
};

const locationScore = (
  preference: PropertyPreferenceState['location'],
  candidate: MatchCandidate['location'],
): number => {
  if (!preference) return 0;
  const hierarchy = hierarchyRatio(preference, candidate);
  if (preference.radiusKm != null) {
    const distance = distanceKm(preference, candidate);
    if (distance == null || preference.radiusKm <= 0) return hierarchy;
    return Math.max(hierarchy, clamp(1 - distance / preference.radiusKm, 0, 1));
  }
  return hierarchy;
};

const moneyToCents = (value: string | null | undefined): bigint | null => {
  if (value == null || !/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
};
const budgetFit = (
  preference: PropertyPreferenceState['budget'],
  candidate: MatchCandidate,
): boolean => {
  if (!preference) return true;
  if (
    !candidate.price ||
    candidate.price.currency !== preference.currency ||
    candidate.price.priceType !== preference.frequency
  )
    return false;
  const low =
    moneyToCents(candidate.price.minPrice) ??
    moneyToCents(candidate.price.maxPrice);
  const high =
    moneyToCents(candidate.price.maxPrice) ??
    moneyToCents(candidate.price.minPrice);
  if (low == null || high == null) return false;
  const requestedMin = moneyToCents(preference.min);
  const requestedMax = moneyToCents(preference.max);
  if (requestedMin == null && requestedMax == null) return true;
  const tolerance = BigInt(
    Math.round(clamp(preference.tolerancePercent ?? 0, 0, 100)),
  );
  const effectiveMin =
    requestedMin == null ? null : (requestedMin * (100n - tolerance)) / 100n;
  const effectiveMax =
    requestedMax == null ? null : (requestedMax * (100n + tolerance)) / 100n;
  if (effectiveMax != null && low > effectiveMax) return false;
  if (effectiveMin != null && high < effectiveMin) return false;
  return true;
};

const evaluateHardCriteria = (
  preference: PropertyPreferenceState,
  candidate: MatchCandidate,
  globallyHardCriteria: readonly string[],
): string[] => {
  const failures: string[] = [];
  const hard = new Set([...preference.hardCriteria, ...globallyHardCriteria]);
  if (
    hard.has('transactionType') &&
    !preference.transactionTypes.includes(candidate.transactionType)
  )
    failures.push('transactionType');
  if (
    hard.has('propertyType') &&
    !preference.propertyTypeUuids.includes(candidate.propertyTypeUuid)
  )
    failures.push('propertyType');
  if (
    hard.has('propertyCategory') &&
    !preference.propertyCategoryUuids.includes(candidate.propertyCategoryUuid)
  )
    failures.push('propertyCategory');
  if (
    hard.has('location') &&
    !locationHardMatch(preference.location, candidate.location)
  )
    failures.push('location');
  if (hard.has('budget') && !budgetFit(preference.budget, candidate))
    failures.push('budget');
  return failures;
};

const weightedScore = (
  preference: PropertyPreferenceState,
  candidate: MatchCandidate,
  signal: BehavioralSignal,
  rule: MatchingRuleRecord | undefined,
): { score: number; explanation: MatchExplanation } => {
  const weights = rule?.weights ?? DEFAULT_MATCHING_RULE;
  const weight = (key: MatchingRuleWeightKey): number =>
    weights[key] ?? DEFAULT_MATCHING_RULE[key] ?? 0;
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
  const hard = new Set([
    ...preference.hardCriteria,
    ...(rule?.hardCriteria ?? []),
  ]);
  const scoreCriterion = (
    key: MatchingRuleWeightKey,
    criterion: string,
    ok: boolean,
  ): void => {
    const points = weight(key);
    if (points <= 0) return;
    possible += points;
    const earnedPoints = ok ? points : 0;
    earned += earnedPoints;
    add(criterion, earnedPoints, ok);
  };

  if (preference.transactionTypes.length > 0 && !hard.has('transactionType'))
    scoreCriterion(
      'transactionType',
      'transactionType',
      preference.transactionTypes.includes(candidate.transactionType),
    );
  if (preference.propertyTypeUuids.length > 0 && !hard.has('propertyType'))
    scoreCriterion(
      'propertyType',
      'propertyType',
      preference.propertyTypeUuids.includes(candidate.propertyTypeUuid),
    );
  if (
    preference.propertyCategoryUuids.length > 0 &&
    !hard.has('propertyCategory')
  )
    scoreCriterion(
      'propertyCategory',
      'propertyCategory',
      preference.propertyCategoryUuids.includes(candidate.propertyCategoryUuid),
    );
  if (preference.budget && !hard.has('budget')) {
    const ok = budgetFit(preference.budget, candidate);
    scoreCriterion('budget', 'budget', ok);
    if (!ok) penalties.push('budget_mismatch');
  }
  if (preference.location && !hard.has('location'))
    scoreCriterion(
      'location',
      'location',
      locationScore(preference.location, candidate.location) > 0,
    );

  const specification = preference.specification;
  const candidateSpecification = candidate.specification;
  if (specification?.bedrooms)
    scoreCriterion(
      'bedrooms',
      'bedrooms',
      rangeMatch(candidateSpecification?.bedrooms ?? null, specification.bedrooms),
    );
  if (specification?.bathrooms)
    scoreCriterion(
      'bathrooms',
      'bathrooms',
      stringRangeMatch(
        candidateSpecification?.bathrooms ?? null,
        specification.bathrooms,
      ),
    );
  if (specification?.areaSqm)
    scoreCriterion(
      'areaSqm',
      'areaSqm',
      stringRangeMatch(
        candidateSpecification?.buildingAreaSqm ?? null,
        specification.areaSqm,
      ),
    );
  if (specification?.parkingSpaces)
    scoreCriterion(
      'parkingSpaces',
      'parkingSpaces',
      rangeMatch(
        candidateSpecification?.parkingSpaces ?? null,
        specification.parkingSpaces,
      ),
    );
  if (specification?.furnishedStatus)
    scoreCriterion(
      'furnishedStatus',
      'furnishedStatus',
      candidateSpecification?.furnishedStatus === specification.furnishedStatus,
    );
  if (specification?.condition)
    scoreCriterion(
      'condition',
      'condition',
      candidateSpecification?.condition === specification.condition,
    );

  const behaviorWeight = weight('behavior');
  if (behaviorWeight > 0) {
    possible += behaviorWeight;
    let behavior = 0;
    if (signal.saved) behavior += behaviorWeight * 0.4;
    if (signal.viewedAt) behavior += behaviorWeight * 0.2;
    if (signal.inquiryCount > 0) behavior += behaviorWeight * 0.4;
    else if (signal.viewCount > 0) behavior += behaviorWeight * 0.1;
    behavior = Math.min(behaviorWeight, behavior);
    earned += behavior;
    contributions.push({ criterion: 'behavior', points: behavior });
    if (behavior > 0) matched.push('behavior');
  }

  const score =
    possible === 0 ? 0 : Math.round((earned / possible) * 10000) / 100;
  return {
    score: clamp(score),
    explanation: { matched, missed, penalties, contributions },
  };
};

export class MatchingEngine {
  evaluate(
    preference: PropertyPreferenceState,
    candidates: readonly MatchCandidate[],
    signals: ReadonlyMap<string, BehavioralSignal>,
    rule?: MatchingRuleRecord,
  ): MatchResult[] {
    const candidateByListing = new Map(
      candidates.map((candidate) => [candidate.listingUuid, candidate]),
    );
    const results: MatchResult[] = [];
    const globallyHardCriteria = rule?.hardCriteria ?? [];
    for (const candidate of candidates) {
      if (
        evaluateHardCriteria(preference, candidate, globallyHardCriteria).length >
        0
      )
        continue;
      const result = weightedScore(
        preference,
        candidate,
        signals.get(candidate.listingUuid) ?? {
          saved: false,
          viewedAt: null,
          inquiryCount: 0,
          viewCount: 0,
        },
        rule,
      );
      if (result.score < Math.max(MIN_SAFE_SCORE, rule?.minimumScore ?? 0))
        continue;
      results.push({
        propertyUuid: candidate.propertyUuid,
        listingUuid: candidate.listingUuid,
        score: result.score,
        explanation: result.explanation,
      });
    }
    return results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const publishedA =
        candidateByListing.get(a.listingUuid)?.publishedAt.getTime() ?? 0;
      const publishedB =
        candidateByListing.get(b.listingUuid)?.publishedAt.getTime() ?? 0;
      if (publishedB !== publishedA) return publishedB - publishedA;
      return a.listingUuid.localeCompare(b.listingUuid);
    });
  }
}
