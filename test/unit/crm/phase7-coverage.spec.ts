import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { CrmAutomationAdapter } from '../../../src/modules/crm/application/services/crm-automation.adapter.js';
import { CrmCommunicationDeliveryService } from '../../../src/modules/crm/application/services/crm-communication-delivery.service.js';
import { CrmCommunicationHealthService } from '../../../src/modules/crm/application/services/crm-communication-health.service.js';
import {
  CommunicationProviderError,
  ProviderNotConfiguredError,
  type CommunicationProvider,
} from '../../../src/modules/crm/infrastructure/providers/communication-provider.js';
import type {
  CommunicationRecord,
  CommunicationRepository,
} from '../../../src/modules/crm/domain/repositories/communication.repository.js';
import type { CrmService } from '../../../src/modules/crm/application/crm.service.js';
import type { AutomationActor } from '../../../src/common/contracts/automation-actor.js';
import type {
  AutomationActivityInput,
  AutomationCommunicationInput,
} from '../../../src/common/contracts/automation-crm.port.js';
import type { SecurityAuditRepository } from '../../../src/common/audit/security-audit.port.js';

const actor: AutomationActor = {
  actorUuid: '11111111-1111-4111-8111-111111111111',
  permissions: ['crm.leads.read'],
  requestId: 'req-1',
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
};

const communication = (
  overrides: Partial<CommunicationRecord> = {},
): CommunicationRecord => ({
  uuid: '22222222-2222-4222-8222-222222222222',
  channel: 'EMAIL',
  direction: 'OUTBOUND',
  status: 'QUEUED',
  contactUuid: null,
  leadUuid: '33333333-3333-4333-8333-333333333333',
  activityUuid: null,
  templateUuid: null,
  providerName: 'test',
  providerMessageId: null,
  providerError: null,
  destination: 'user@example.com',
  subject: 'Subject',
  body: 'Body',
  ...overrides,
});

type Providers = Map<'EMAIL' | 'WHATSAPP' | 'SMS', CommunicationProvider>;

const setProviders = (
  service: CrmCommunicationDeliveryService,
  providers: Providers,
): void => {
  const state = service as unknown as { providers: Providers };
  state.providers.clear();
  for (const [channel, provider] of providers) {
    state.providers.set(channel, provider);
  }
};

describe('CRM phase 7 coverage', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('covers automation adapter mappings and delegation', async () => {
    const getLead = vi.fn<CrmService['getLead']>().mockResolvedValue({
      contactUuid: 'contact-1',
      status: { code: 'NEW' },
      source: { code: 'WEB' },
      type: { code: 'BUYER' },
      ownerUserUuid: 'owner-1',
      score: 42,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    const activityGet = vi
      .fn<CrmService['activityGet']>()
      .mockResolvedValue({ uuid: 'activity-1', done: true });
    const assign = vi
      .fn<CrmService['assign']>()
      .mockResolvedValue({ uuid: 'lead-1' });
    const recalcScore = vi
      .fn<CrmService['recalcScore']>()
      .mockResolvedValue({ uuid: 'lead-1', score: 50 });
    const activityCreate = vi
      .fn<CrmService['activityCreate']>()
      .mockResolvedValue({ uuid: 'activity-2' });
    const communicationCreate = vi
      .fn<CrmService['communicationCreate']>()
      .mockResolvedValue({ uuid: 'communication-1' });
    const changeStatus = vi
      .fn<CrmService['changeStatus']>()
      .mockResolvedValue({ uuid: 'lead-1', status: 'QUALIFIED' });
    const crm = {
      getLead,
      activityGet,
      assign,
      recalcScore,
      activityCreate,
      communicationCreate,
      changeStatus,
    } as unknown as CrmService;
    const deliver = vi
      .fn<CrmCommunicationDeliveryService['deliver']>()
      .mockResolvedValue({ uuid: 'communication-1' });
    const delivery = {
      deliver,
    } as unknown as CrmCommunicationDeliveryService;
    const adapter = new CrmAutomationAdapter(crm, delivery);

    await expect(adapter.getLead('lead-1')).resolves.toMatchObject({
      uuid: 'lead-1',
      contactUuid: 'contact-1',
      status: 'NEW',
      source: 'WEB',
      type: 'BUYER',
      ownerUserUuid: 'owner-1',
      score: 42,
    });
    await expect(adapter.getActivity('activity-1')).resolves.toMatchObject({
      uuid: 'activity-1',
    });
    getLead.mockResolvedValueOnce({
      contact: { preferences: { time: 'morning' } },
    });
    await expect(adapter.getLeadPreferences('lead-1')).resolves.toEqual({
      time: 'morning',
    });
    getLead.mockResolvedValueOnce({});
    await expect(adapter.getLeadPreferences('lead-1')).resolves.toEqual({});

    await adapter.assignLead('lead-1', 'user-1', actor);
    await adapter.refreshLeadScore('lead-1', actor);
    const activityInput: AutomationActivityInput = {
      type: 'CALL',
      subject: 'Follow up',
    };
    await adapter.createActivity(activityInput, actor);
    const communicationInput: AutomationCommunicationInput = {
      channel: 'EMAIL',
      body: 'Hello',
    };
    await adapter.enqueueCommunication(communicationInput, actor);
    await adapter.deliverCommunication('communication-1', actor);
    await adapter.changeLeadStatus('lead-1', 'status-1', actor);

    expect(assign).toHaveBeenCalledWith(
      'lead-1',
      'user-1',
      expect.objectContaining({ actorUuid: actor.actorUuid }),
    );
    expect(deliver).toHaveBeenCalledWith(
      'communication-1',
      actor.actorUuid,
    );
  });

  it('covers communication delivery success, idempotent path and failure modes', async () => {
    const findByUuid = vi
      .fn<CommunicationRepository['findByUuid']>()
      .mockResolvedValue(communication());
    const transitionCommunication = vi
      .fn<CommunicationRepository['transitionCommunication']>()
      .mockImplementation(async (_uuid, status, input) =>
        communication({
          status,
          providerMessageId: input?.providerMessageId ?? null,
          providerError: input?.providerError ?? null,
        }),
      );
    const repository: CommunicationRepository = {
      findByUuid,
      transitionCommunication,
    };
    const record = vi.fn<SecurityAuditRepository['record']>().mockResolvedValue(
      undefined,
    );
    const audit: SecurityAuditRepository = { record };
    const config = new ConfigService({
      EMAIL_PROVIDER_URL: 'https://provider.example.com/send',
      EMAIL_PROVIDER_TOKEN: 'token',
    });
    const service = new CrmCommunicationDeliveryService(
      repository,
      audit,
      config,
    );

    const providerSend = vi
      .fn<CommunicationProvider['send']>()
      .mockResolvedValue({ providerMessageId: 'pm-1' });
    const provider: CommunicationProvider = {
      channel: 'EMAIL',
      send: providerSend,
    };
    setProviders(service, new Map([['EMAIL', provider]]));
    await expect(
      service.deliver(communication().uuid, actor.actorUuid),
    ).resolves.toMatchObject({ status: 'SENT', providerMessageId: 'pm-1' });
    expect(providerSend).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: `crm-communication:${communication().uuid}`,
      }),
    );

    findByUuid.mockResolvedValue(communication({ status: 'SENT' }));
    await expect(service.deliver(communication().uuid)).resolves.toMatchObject({
      status: 'SENT',
    });

    findByUuid.mockResolvedValue(null);
    await expect(service.deliver(communication().uuid)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    findByUuid.mockResolvedValue(communication({ channel: 'FAX' }));
    await expect(service.deliver(communication().uuid)).rejects.toThrow(
      'Unsupported communication channel',
    );

    findByUuid.mockResolvedValue(communication());
    setProviders(service, new Map());
    await expect(
      service.deliver(communication().uuid, actor.actorUuid),
    ).rejects.toBeInstanceOf(ProviderNotConfiguredError);
    expect(transitionCommunication).toHaveBeenCalledWith(
      communication().uuid,
      'FAILED',
      expect.any(Object),
    );

    const retryFindByUuid = vi
      .fn<CommunicationRepository['findByUuid']>()
      .mockResolvedValue(communication());
    const retryTransition = vi
      .fn<CommunicationRepository['transitionCommunication']>()
      .mockImplementation(async (_uuid, status, input) =>
        communication({
          status,
          providerError: input?.providerError ?? null,
        }),
      );
    const retryRepository: CommunicationRepository = {
      findByUuid: retryFindByUuid,
      transitionCommunication: retryTransition,
    };
    const retryRecord = vi
      .fn<SecurityAuditRepository['record']>()
      .mockResolvedValue(undefined);
    const retryService = new CrmCommunicationDeliveryService(
      retryRepository,
      { record: retryRecord },
      config,
    );
    const retrySend = vi
      .fn<CommunicationProvider['send']>()
      .mockRejectedValue(new CommunicationProviderError('retry', true, 503));
    setProviders(
      retryService,
      new Map([[
        'EMAIL',
        { channel: 'EMAIL', send: retrySend },
      ]]),
    );
    await expect(
      retryService.deliver(communication().uuid, actor.actorUuid),
    ).rejects.toBeInstanceOf(CommunicationProviderError);
    expect(retryTransition).toHaveBeenCalledWith(
      communication().uuid,
      'QUEUED',
      expect.objectContaining({ providerError: 'retry' }),
    );

    const permanentFindByUuid = vi
      .fn<CommunicationRepository['findByUuid']>()
      .mockResolvedValue(communication());
    const permanentTransition = vi
      .fn<CommunicationRepository['transitionCommunication']>()
      .mockImplementation(async (_uuid, status, input) =>
        communication({
          status,
          providerError: input?.providerError ?? null,
        }),
      );
    const permanentRepository: CommunicationRepository = {
      findByUuid: permanentFindByUuid,
      transitionCommunication: permanentTransition,
    };
    const permanentService = new CrmCommunicationDeliveryService(
      permanentRepository,
      audit,
      config,
    );
    const permanentSend = vi
      .fn<CommunicationProvider['send']>()
      .mockRejectedValue(new CommunicationProviderError('bad', false, 400));
    setProviders(
      permanentService,
      new Map([[
        'EMAIL',
        { channel: 'EMAIL', send: permanentSend },
      ]]),
    );
    await expect(
      permanentService.deliver(communication().uuid),
    ).rejects.toBeInstanceOf(CommunicationProviderError);
    expect(permanentTransition).toHaveBeenCalledWith(
      communication().uuid,
      'FAILED',
      expect.objectContaining({ providerError: 'bad' }),
    );
  });

  it('covers communication health endpoint states', () => {
    const config = new ConfigService({
      'email.providerUrl': 'https://email.example.com',
      'whatsapp.providerUrl': 'http://wa.example.com',
      'sms.providerUrl': 'https://10.0.0.1',
    });
    const service = new CrmCommunicationHealthService(config);
    const result = service.status();
    expect(result.channels.EMAIL).toEqual({
      configured: true,
      reachable: false,
      reason: 'health_check_not_executed',
    });
    expect(result.channels.WHATSAPP).toEqual({
      configured: true,
      reachable: false,
      reason: 'invalid_provider_endpoint',
    });
    expect(result.channels.SMS).toEqual({
      configured: true,
      reachable: false,
      reason: 'invalid_provider_endpoint',
    });

    const missing = new CrmCommunicationHealthService(new ConfigService());
    expect(missing.status().channels.EMAIL).toEqual({
      configured: false,
      reachable: false,
      reason: 'provider_not_configured',
    });

    const malformed = new CrmCommunicationHealthService(
      new ConfigService({ 'email.providerUrl': 'not-a-url' }),
    );
    expect(malformed.status().channels.EMAIL).toEqual({
      configured: true,
      reachable: false,
      reason: 'invalid_provider_endpoint',
    });
  });
});
