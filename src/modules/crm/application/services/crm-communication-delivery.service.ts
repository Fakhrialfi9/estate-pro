import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { SecurityAuditRepository } from '../../../../common/audit/security-audit.port.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../../common/audit/security-audit.port.js';
import {
  COMMUNICATION_REPOSITORY,
  type CommunicationRecord,
  type CommunicationRepository,
} from '../../domain/repositories/communication.repository.js';
import type { CommunicationProvider } from '../../infrastructure/providers/communication-provider.js';
import {
  CommunicationProviderError,
  ProviderNotConfiguredError,
} from '../../infrastructure/providers/communication-provider.js';
import { HttpCommunicationProvider } from '../../infrastructure/providers/http-communication-provider.js';

const CHANNELS = ['EMAIL', 'WHATSAPP', 'SMS'] as const;
type CommunicationChannel = (typeof CHANNELS)[number];

@Injectable()
export class CrmCommunicationDeliveryService {
  private readonly providers = new Map<
    CommunicationChannel,
    CommunicationProvider
  >();

  constructor(
    @Inject(COMMUNICATION_REPOSITORY)
    private readonly repository: CommunicationRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {
    for (const channel of CHANNELS) {
      const endpoint = process.env[`${channel}_PROVIDER_URL`];
      if (!endpoint) continue;
      this.providers.set(
        channel,
        new HttpCommunicationProvider(
          channel,
          endpoint,
          process.env[`${channel}_PROVIDER_TOKEN`],
        ),
      );
    }
  }

  async deliver(uuid: string, actorUuid?: string) {
    const communication = await this.repository.findByUuid(uuid);
    if (!communication) {
      throw new NotFoundException('Communication not found');
    }
    if (communication.status !== 'QUEUED') {
      return this.toPublic(communication);
    }

    const channel = communication.channel.toUpperCase() as CommunicationChannel;
    if (!CHANNELS.includes(channel)) {
      throw new Error(
        `Unsupported communication channel: ${communication.channel}`,
      );
    }

    const provider = this.providers.get(channel);
    if (!provider) {
      await this.fail(uuid, actorUuid, 'PROVIDER_NOT_CONFIGURED');
      throw new ProviderNotConfiguredError(channel);
    }

    try {
      const result = await provider.send({
        destination: communication.destination,
        subject: communication.subject ?? undefined,
        body: communication.body,
        idempotencyKey: `crm-communication:${communication.uuid}`,
      });
      const updated = await this.repository.transitionCommunication(
        uuid,
        'SENT',
        { providerMessageId: result.providerMessageId },
      );
      await this.audit.record({
        action: 'CRM_COMMUNICATION_STATUS_CHANGED',
        actorUuid,
        entityType: 'communication',
        entityUuid: uuid,
        result: 'SUCCESS',
        reason: `communication.delivered:${channel}`,
      });
      return this.toPublic(updated);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Provider delivery failed';
      if (error instanceof CommunicationProviderError && error.retryable) {
        await this.recordRetryableFailure(uuid, actorUuid, message);
      } else {
        await this.fail(uuid, actorUuid, message.slice(0, 240));
      }
      throw error;
    }
  }

  private async recordRetryableFailure(
    uuid: string,
    actorUuid: string | undefined,
    reason: string,
  ) {
    const updated = await this.repository.transitionCommunication(
      uuid,
      'QUEUED',
      { providerError: reason.slice(0, 240) },
    );
    await this.audit.record({
      action: 'CRM_COMMUNICATION_STATUS_CHANGED',
      actorUuid,
      entityType: 'communication',
      entityUuid: uuid,
      result: 'FAILURE',
      reason: `communication.delivery_retryable:${reason.slice(0, 160)}`,
    });
    return updated;
  }

  private async fail(
    uuid: string,
    actorUuid: string | undefined,
    reason: string,
  ) {
    const updated = await this.repository.transitionCommunication(
      uuid,
      'FAILED',
      { providerError: reason },
    );
    await this.audit.record({
      action: 'CRM_COMMUNICATION_STATUS_CHANGED',
      actorUuid,
      entityType: 'communication',
      entityUuid: uuid,
      result: 'FAILURE',
      reason: `communication.delivery_failed:${reason}`,
    });
    return updated;
  }

  private toPublic(row: CommunicationRecord) {
    return {
      uuid: row.uuid,
      channel: row.channel,
      status: row.status,
      providerName: row.providerName,
      providerMessageId: row.providerMessageId,
    };
  }
}
