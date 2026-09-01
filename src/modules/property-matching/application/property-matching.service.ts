import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { metrics } from '@opentelemetry/api';
import { AuthorizationService } from '../../../common/security/authorization.service.js';
import { SECURITY_AUDIT_REPOSITORY, type SecurityAuditRepository } from '../../../common/audit/security-audit.port.js';
import { MATCHING_ALGORITHM_VERSION, MAX_CANDIDATE_POOL, MAX_MATCH_PAGE_SIZE, MIN_SAFE_SCORE, type MatchFeedbackType, type MatchingSubjectType, type PropertyPreferenceState } from '../domain/matching.types.js';
import { PropertyPreference } from '../domain/property-preference.js';
import { MatchingEngine } from '../domain/matching-engine.js';
import { MATCHING_REPOSITORY, type MatchingRepository } from './matching.ports.js';
import { MATCHING_AUDIT_ACTIONS } from '../infrastructure/matching-audit.actions.js';

const meter = metrics.getMeter('estate-pro.property-matching');
const requestCounter = meter.createCounter('property_matching_requests_total');
const failureCounter = meter.createCounter('property_matching_failures_total');
const candidateHistogram = meter.createHistogram('property_matching_candidate_count');
const durationHistogram = meter.createHistogram('property_matching_duration_ms');

export type MatchingActor = { actorUuid: string; permissions: readonly string[]; requestId?: string; ipAddress?: string; userAgent?: string };
export type PreferenceInput = Omit<PropertyPreferenceState, 'version'>;

@Injectable()
export class PropertyMatchingService {
  constructor(
    @Inject(MATCHING_REPOSITORY) private readonly repository: MatchingRepository,
    private readonly engine: MatchingEngine,
    private readonly authorization: AuthorizationService,
    @Inject(SECURITY_AUDIT_REPOSITORY) private readonly audit: SecurityAuditRepository,
  ) {}

  async getPreference(subjectType: MatchingSubjectType, subjectUuid: string, actor: MatchingActor) {
    await this.assertSubjectAccess(subjectType, subjectUuid, actor);
    const preference = await this.repository.findPreference(subjectType, subjectUuid);
    if (!preference) throw new NotFoundException('Matching preference not found');
    return preference;
  }

  async createPreference(subjectType: MatchingSubjectType, subjectUuid: string, input: PreferenceInput, actor: MatchingActor) {
    await this.assertSubjectAccess(subjectType, subjectUuid, actor);
    const existing = await this.repository.findPreference(subjectType, subjectUuid);
    const preference = PropertyPreference.create({ ...input, version: (existing?.version ?? 0) + 1 }).value;
    let result;
    if (!existing) result = await this.repository.createPreference(subjectType, subjectUuid, preference);
    else if (existing.status === 'ARCHIVED') result = await this.repository.restorePreference(subjectType, subjectUuid, existing.version, preference);
    else throw new ConflictException('Matching preference already exists');
    await this.auditSafe(MATCHING_AUDIT_ACTIONS.PREFERENCE_CREATED, subjectUuid, actor, subjectType);
    return result;
  }

  async updatePreference(subjectType: MatchingSubjectType, subjectUuid: string, expectedVersion: number, input: PreferenceInput, actor: MatchingActor) {
    await this.assertSubjectAccess(subjectType, subjectUuid, actor);
    const current = await this.repository.findPreference(subjectType, subjectUuid);
    if (!current) throw new NotFoundException('Matching preference not found');
    if (current.status !== 'ACTIVE' || current.version !== expectedVersion) throw new ConflictException('Preference version is stale');
    const preference = PropertyPreference.create({ ...input, version: current.version + 1 }).value;
    const updated = await this.repository.updatePreference(subjectType, subjectUuid, expectedVersion, preference);
    await this.auditSafe(MATCHING_AUDIT_ACTIONS.PREFERENCE_UPDATED, subjectUuid, actor, subjectType);
    return updated;
  }

  async archivePreference(subjectType: MatchingSubjectType, subjectUuid: string, expectedVersion: number, actor: MatchingActor) {
    await this.assertSubjectAccess(subjectType, subjectUuid, actor);
    const result = await this.repository.archivePreference(subjectType, subjectUuid, expectedVersion);
    await this.auditSafe(MATCHING_AUDIT_ACTIONS.PREFERENCE_ARCHIVED, subjectUuid, actor, subjectType);
    return result;
  }

  async restorePreference(subjectType: MatchingSubjectType, subjectUuid: string, expectedVersion: number, actor: MatchingActor) {
    await this.assertSubjectAccess(subjectType, subjectUuid, actor);
    const current = await this.repository.findPreference(subjectType, subjectUuid);
    if (!current || current.status !== 'ARCHIVED' || current.version !== expectedVersion) throw new ConflictException('Preference version is stale');
    return this.repository.restorePreference(subjectType, subjectUuid, expectedVersion, PropertyPreference.create({ ...current, version: current.version + 1 }).value);
  }

  async match(subjectType: MatchingSubjectType, subjectUuid: string, options: { minScore?: number; page?: number; limit?: number }, actor: MatchingActor) {
    await this.assertSubjectAccess(subjectType, subjectUuid, actor);
    const preference = await this.requireActivePreference(subjectType, subjectUuid);
    const start = performance.now();
    requestCounter.add(1, { operation: 'match' });
    try {
      const pool = await this.repository.listCandidates({ preference, now: new Date(), limit: MAX_CANDIDATE_POOL });
      candidateHistogram.record(pool.length);
      const signals = await this.repository.getSignals(actor.actorUuid, pool.map((candidate) => candidate.listingUuid));
      const ranked = this.engine.evaluate(preference, pool, signals).filter((item) => item.score >= this.minimum(options.minScore));
      const page = Math.max(1, options.page ?? 1);
      const limit = Math.min(MAX_MATCH_PAGE_SIZE, Math.max(1, options.limit ?? 20));
      return { data: ranked.slice((page - 1) * limit, page * limit), meta: { page, limit, total: ranked.length, totalPages: Math.ceil(ranked.length / limit), candidateCount: pool.length, algorithmVersion: MATCHING_ALGORITHM_VERSION } };
    } catch (error) {
      failureCounter.add(1, { operation: 'match' });
      throw error;
    } finally {
      durationHistogram.record(performance.now() - start, { operation: 'match' });
    }
  }

  async generate(subjectType: MatchingSubjectType, subjectUuid: string, source: 'GENERATED' | 'REFRESHED' | 'RECALCULATED', options: { minScore?: number; limit?: number }, actor: MatchingActor) {
    await this.assertSubjectAccess(subjectType, subjectUuid, actor);
    const preference = await this.requireActivePreference(subjectType, subjectUuid);
    const start = performance.now();
    requestCounter.add(1, { operation: 'generate' });
    try {
      const pool = await this.repository.listCandidates({ preference, now: new Date(), limit: MAX_CANDIDATE_POOL });
      candidateHistogram.record(pool.length);
      const signals = await this.repository.getSignals(actor.actorUuid, pool.map((candidate) => candidate.listingUuid));
      const results = this.engine.evaluate(preference, pool, signals).filter((item) => item.score >= this.minimum(options.minScore)).slice(0, Math.min(MAX_MATCH_PAGE_SIZE, Math.max(1, options.limit ?? 20)));
      const generatedAt = new Date();
      const snapshot = await this.repository.saveRecommendation({
        subjectType, subjectUuid, preferenceVersion: preference.version, algorithmVersion: MATCHING_ALGORITHM_VERSION, source, candidateCount: pool.length,
        items: results.map((item, index) => ({ propertyUuid: item.propertyUuid, listingUuid: item.listingUuid, rank: index + 1, score: item.score, explanation: JSON.stringify(item.explanation) })), now: generatedAt,
      });
      await this.auditSafe(source === 'GENERATED' ? MATCHING_AUDIT_ACTIONS.RECOMMENDATION_GENERATED : MATCHING_AUDIT_ACTIONS.RECOMMENDATION_REFRESHED, snapshot.uuid, actor, 'RECOMMENDATION');
      return { ...snapshot, preferenceVersion: preference.version, algorithmVersion: MATCHING_ALGORITHM_VERSION };
    } catch (error) {
      failureCounter.add(1, { operation: 'generate' });
      throw error;
    } finally {
      durationHistogram.record(performance.now() - start, { operation: 'generate' });
    }
  }

  async getLatest(subjectType: MatchingSubjectType, subjectUuid: string, actor: MatchingActor) {
    await this.assertSubjectAccess(subjectType, subjectUuid, actor);
    const result = await this.repository.getLatestRecommendation(subjectType, subjectUuid);
    if (!result) throw new NotFoundException('Recommendation not found');
    return result;
  }

  async getHistory(subjectType: MatchingSubjectType, subjectUuid: string, page: number, limit: number, actor: MatchingActor) {
    await this.assertSubjectAccess(subjectType, subjectUuid, actor);
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(MAX_MATCH_PAGE_SIZE, Math.max(1, limit));
    const result = await this.repository.listRecommendationHistory(subjectType, subjectUuid, safePage, safeLimit);
    return { data: result.items, meta: { page: safePage, limit: safeLimit, total: result.total, totalPages: Math.ceil(result.total / safeLimit) } };
  }

  async submitFeedback(input: { recommendationItemUuid: string; subjectType: MatchingSubjectType; subjectUuid: string; propertyUuid: string; listingUuid: string; feedback: MatchFeedbackType }, actor: MatchingActor) {
    await this.assertSubjectAccess(input.subjectType, input.subjectUuid, actor);
    const result = await this.repository.recordFeedback(input);
    await this.auditSafe(MATCHING_AUDIT_ACTIONS.FEEDBACK_RECORDED, input.recommendationItemUuid, actor, 'FEEDBACK');
    return result;
  }

  async savedProperties(actor: MatchingActor) { return { data: await this.repository.listSavedListings(actor.actorUuid) }; }

  private async requireActivePreference(subjectType: MatchingSubjectType, subjectUuid: string) {
    const preference = await this.repository.findPreference(subjectType, subjectUuid);
    if (!preference || preference.status !== 'ACTIVE') throw new NotFoundException('Active matching preference not found');
    return preference;
  }

  private minimum(requested?: number): number { return Math.min(100, Math.max(MIN_SAFE_SCORE, requested ?? MIN_SAFE_SCORE)); }

  private async assertSubjectAccess(subjectType: MatchingSubjectType, subjectUuid: string, actor: MatchingActor): Promise<void> {
    if (subjectType === 'USER' && subjectUuid === actor.actorUuid) return;
    const scope = await this.repository.getPreferenceSubjectScope(subjectType, subjectUuid);
    if (!scope) throw new NotFoundException('Matching subject not found');
    if (scope.ownerUserUuid === actor.actorUuid) return;
    const permission = subjectType === 'CONTACT' ? 'crm.contacts.read' : 'crm.leads.read';
    const snapshot = await this.authorization.resolve(actor.actorUuid);
    try { this.authorization.assertPermissions(snapshot, [permission], 'OR'); }
    catch { this.authorization.assertPermissions(snapshot, ['sales.manage'], 'OR'); }
  }

  private async auditSafe(action: string, entityUuid: string, actor: MatchingActor, entityType: string): Promise<void> {
    await this.audit.record({ action, actorUuid: actor.actorUuid, userUuid: actor.actorUuid, actorType: 'AUTHENTICATED', entityType, entityUuid, requestId: actor.requestId, ipAddress: actor.ipAddress, userAgent: actor.userAgent, result: 'SUCCESS' });
  }
}