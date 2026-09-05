import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { SecurityAuditRepository } from '../../../../common/audit/security-audit.port.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../../common/audit/security-audit.port.js';
import type { IntegrationProviderPort } from '../../domain/integration/integration.contracts.js';
import { SYSTEM_ROADMAP_REPOSITORY, type SystemRoadmapRepository, type IntegrationCredentialRecord } from '../../domain/repositories/system-roadmap.repository.js';

const REF_PATTERN = /^vault:\/[A-Za-z0-9._\/-]{1,240}$/;
const REFRESH_SKEW_MS = 60_000;

@Injectable()
export class SystemIntegrationCredentialService {
  constructor(
    @Inject(SYSTEM_ROADMAP_REPOSITORY) private readonly roadmap: SystemRoadmapRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY) private readonly audit: SecurityAuditRepository,
  ) {}

  async refresh(uuid: string, actorUuid: string, provider: IntegrationProviderPort) {
    const credential = await this.require(uuid);
    if (credential.status === 'REVOKED' || credential.status === 'ROTATED') throw new BadRequestException('Credential is not active');
    if (credential.credentialType !== 'OAUTH2' && credential.credentialType !== 'oauth2') throw new BadRequestException('Credential does not support token refresh');
    if (!credential.refreshTokenRef) throw new BadRequestException('Refresh token reference is not configured');
    if (!provider.refreshAccessToken) throw new BadRequestException('Provider token refresh is not configured');
    if (credential.refreshTokenExpiresAt && credential.refreshTokenExpiresAt.getTime() <= Date.now()) {
      await this.roadmap.credential.revoke(uuid, new Date());
      throw new BadRequestException('Refresh credential has expired');
    }
    const result = await provider.refreshAccessToken({ clientReference: credential.secretRef ?? '', refreshTokenReference: credential.refreshTokenRef, scopes: this.scopes(credential.metadata) });
    this.assertRef(result.accessTokenReference);
    if (result.refreshTokenReference) this.assertRef(result.refreshTokenReference);
    const rotated = await this.roadmap.credential.rotate(uuid, {
      secretRef: credential.secretRef,
      accessTokenRef: result.accessTokenReference,
      refreshTokenRef: result.refreshTokenReference ?? credential.refreshTokenRef,
      accessTokenExpiresAt: result.accessTokenExpiresAt,
      refreshTokenExpiresAt: result.refreshTokenExpiresAt ?? credential.refreshTokenExpiresAt,
      metadata: credential.metadata,
    });
    await this.audit.record({ action: 'SYSTEM_SETTING_UPDATED', actorUuid, subjectUuid: actorUuid, entityType: 'system_integration_credential', entityUuid: rotated.uuid, result: 'SUCCESS', reason: 'oauth-access-token-refreshed' });
    return this.safe(rotated);
  }

  async shouldRefresh(credentialUuid: string) {
    const credential = await this.require(credentialUuid);
    if (!credential.accessTokenExpiresAt) return false;
    return credential.accessTokenExpiresAt.getTime() - Date.now() <= REFRESH_SKEW_MS;
  }

  private async require(uuid: string): Promise<IntegrationCredentialRecord> {
    const credential = await this.roadmap.credential.get(uuid);
    if (!credential) throw new NotFoundException('Integration credential not found');
    return credential;
  }

  private scopes(metadata: Record<string, unknown>): readonly string[] {
    const value = metadata.scopes;
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string').slice(0, 50);
  }

  private assertRef(value: string) { if (!REF_PATTERN.test(value)) throw new BadRequestException('Credential provider returned invalid reference'); }
  private safe(row: IntegrationCredentialRecord) { return { ...row, secretRef: row.secretRef ? 'vault://redacted' : null, accessTokenRef: row.accessTokenRef ? 'vault://redacted' : null, refreshTokenRef: row.refreshTokenRef ? 'vault://redacted' : null }; }
}
