import type {
  CertificateCreateInput,
  CertificateUpdateInput,
  EnvironmentPatch,
  FeaturePatch,
  FinancialPatch,
  JsonValue,
  LegalPatch,
  MediaCreateInput,
  MediaUpdateInput,
  SecurityPatch,
  SeoPatch,
  UtilityPatch,
} from '../property-extras.js';

export type PropertyExtrasActor = {
  actorUuid?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
};

export interface PropertyExtrasRepository {
  getPropertySlug(propertyUuid: string): Promise<string>;
  getUtilities(propertyUuid: string): Promise<unknown>;
  upsertUtilities(propertyUuid: string, patch: UtilityPatch, actor: PropertyExtrasActor): Promise<unknown>;
  getLegal(propertyUuid: string): Promise<unknown>;
  upsertLegal(propertyUuid: string, patch: LegalPatch, actor: PropertyExtrasActor): Promise<unknown>;
  listCertificates(propertyUuid: string): Promise<unknown[]>;
  createCertificate(propertyUuid: string, input: CertificateCreateInput, actor: PropertyExtrasActor): Promise<unknown>;
  updateCertificate(propertyUuid: string, certificateUuid: string, input: CertificateUpdateInput, actor: PropertyExtrasActor): Promise<unknown>;
  deleteCertificate(propertyUuid: string, certificateUuid: string, actor: PropertyExtrasActor): Promise<void>;
  getFinancial(propertyUuid: string): Promise<unknown>;
  upsertFinancial(propertyUuid: string, patch: FinancialPatch, actor: PropertyExtrasActor): Promise<unknown>;
  getFeatures(propertyUuid: string): Promise<unknown>;
  upsertFeatures(propertyUuid: string, patch: FeaturePatch, actor: PropertyExtrasActor): Promise<unknown>;
  getSecurity(propertyUuid: string): Promise<unknown>;
  upsertSecurity(propertyUuid: string, patch: SecurityPatch, actor: PropertyExtrasActor): Promise<unknown>;
  getEnvironment(propertyUuid: string): Promise<unknown>;
  upsertEnvironment(propertyUuid: string, patch: EnvironmentPatch, actor: PropertyExtrasActor): Promise<unknown>;
  getSeo(propertyUuid: string): Promise<unknown>;
  upsertSeo(propertyUuid: string, patch: SeoPatch, actor: PropertyExtrasActor): Promise<unknown>;
  listMedia(propertyUuid: string): Promise<unknown[]>;
  addMedia(propertyUuid: string, input: MediaCreateInput, actor: PropertyExtrasActor): Promise<unknown>;
  updateMedia(propertyUuid: string, mediaUuid: string, input: MediaUpdateInput, actor: PropertyExtrasActor): Promise<unknown>;
  deleteMedia(propertyUuid: string, mediaUuid: string, actor: PropertyExtrasActor): Promise<void>;
  setCover(propertyUuid: string, mediaUuid: string, actor: PropertyExtrasActor): Promise<unknown>;
  reorderMedia(propertyUuid: string, mediaUuids: string[], actor: PropertyExtrasActor): Promise<unknown[]>;
}

export type PropertyExtrasJsonRecord = Record<string, JsonValue>;
export const PROPERTY_EXTRAS_REPOSITORY = Symbol('PROPERTY_EXTRAS_REPOSITORY');
