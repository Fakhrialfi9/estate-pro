import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SecurityAuditRepository } from '../../../../common/audit/security-audit.port.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../../common/audit/security-audit.port.js';
import type { IntegrationProviderPort } from '../../domain/integration/integration.contracts.js';
import {
  SYSTEM_ROADMAP_REPOSITORY,
  type SystemRoadmapRepository,
  type IntegrationCredentialRecord,
} from '../../domain/repositories/system-roadmap.repository.js';

const REF_PATTERN = /^vault:\/[A-Za-z0-9._/-]{1,240}$/;
const REFRESH_SKEW_MS = 60_000;

@Injectable()
export class SystemIntegrationCredentialService {
  constructor(
    @Inject(SYSTEM_ROADMAP_REPOSITORY)
    private readonly roadmap: SystemRoadmapRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {}

  async refresh(
    uuid: string,
    actorUuid: string,
    provider: IntegrationProviderPort,
  ) {
    const credential = await this.require(uuid);
    if (credential.status === 'REVOKED' || credential.status === 'ROTATED')
      throw new BadRequestException('Credential is not active');
    if (!credential.refreshTokenRef)
      throw new BadRequestException('Credential has no refresh token');
    if (
      credential.accessTokenExpiresAt &&
      credential.accessTokenExpiresAt.getTime() > Date.now() + REFRESH_SKEW_MS
    ) {
      return this.redact(credential);
    }
    if (!provider.refreshAccessToken)
      throw new BadRequestException('Provider does not support OAuth refresh');
    const tokens = await provider.refreshAccessToken({
      refreshTokenRef: credential.refreshTokenRef,
    });
    if (!tokens.accessTokenRef || !REF_PATTERN.test(tokens.accessTokenRef))
      throw new BadRequestException('Provider returned an invalid access token reference');
    if (!tokens.refreshTokenRef || !REF_PATTERN.test(tokens.refreshTokenRef))
      throw new BadRequestException('Provider returned an invalid refresh token reference');
    const rotated = await this.roadmap.credential.rotate(uuid, {
      secretRef: credential.secretRef,
      accessTokenRef: tokens.accessTokenRef,
      refreshTokenRef: tokens.refreshTokenRef,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      metadata: credential.metadata,
    });
    await this.roadmap.credential.markUsed(rotated.uuid, new Date());
    await this.audit.record({
      actorUuid,
      action: 'integration-credential-refreshed',
      resourceType: 'system_integration_credential',
      resourceUuid: rotated.uuid,
      metadata: {},
    });
    return this.redact(rotated);
  }

  async get(uuid: string) {
    return this.redact(await this.require(uuid));
  }

  private async require(uuid: string): Promise<IntegrationCredentialRecord> {
    const row = await this.roadmap.credential.get(uuid);
    if (!row) throw new NotFoundException('Integration credential not found');
    return row;
  }

  private redact(row: IntegrationCredentialRecord) {
    return {
      ...row,
      secretRef: row.secretRef ? 'vault://***' : null,
      accessTokenRef: row.accessTokenRef ? 'vault://***' : null,
      refreshTokenRef: row.refreshTokenRef ? 'vault://***' : null,
    };
  }
}
