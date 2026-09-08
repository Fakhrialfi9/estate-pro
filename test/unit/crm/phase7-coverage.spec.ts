import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { CrmAutomationAdapter } from '../../../src/modules/crm/application/services/crm-automation.adapter.js';
import { CrmCommunicationDeliveryService } from '../../../src/modules/crm/application/services/crm-communication-delivery.service.js';
import { CrmCommunicationHealthService } from '../../../src/modules/crm/application/services/crm-communication-health.service.js';
import { CommunicationProviderError, ProviderNotConfiguredError } from '../../../src/modules/crm/infrastructure/providers/communication-provider.js';
import type { CommunicationRecord, CommunicationRepository } from '../../../src/modules/crm/domain/repositories/communication.repository.js';
import type { CrmService } from '../../../src/modules/crm/application/crm.service.js';
import type { AutomationActor } from '../../../src/common/contracts/automation-actor.js';

const actor: AutomationActor = {
  actorUuid: '11111111-1111-4111-8111-111111111111',
  permissions: ['crm.leads.read'],
  requestId: 'req-1',
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
};

const communication = (overrides: Partial<CommunicationRecord> = {}): CommunicationRecord => ({
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

describe('CRM phase 7 coverage', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('covers automation adapter mappings and delegation', async () => {
    const crm = {
      getLead: vi.fn().mockResolvedValue({
        contactUuid: 'contact-1',
        status: { code: 'NEW' },
        source: { code: 'WEB' },
        type: { code: 'BUYER' },
        ownerUserUuid: 'owner-1',
        score: 42,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      }),
      activityGet: vi.fn().mockResolvedValue({ uuid: 'activity-1', done: true }),
      assign: vi.fn().mockResolvedValue({ uuid: 'lead-1' }),
      recalcScore: vi.fn().mockResolvedValue({ uuid: 'lead-1', score: 50 }),
      activityCreate: vi.fn().mockResolvedValue({ uuid: 'activity-2' }),
      communicationCreate: vi.fn().mockResolvedValue({ uuid: 'communication-1' }),
      changeStatus: vi.fn().mockResolvedValue({ uuid: 'lead-1', status: 'QUALIFIED' }),
    } as unknown as CrmService;
    const delivery = { deliver: vi.fn().mockResolvedValue({ uuid: 'communication-1' }) };
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
    await expect(adapter.getActivity('activity-1')).resolves.toMatchObject({ uuid: 'activity-1' });
    crm.getLead.mockResolvedValueOnce({ contact: { preferences: { time: 'morning' } } });
    await expect(adapter.getLeadPreferences('lead-1')).resolves.toEqual({ time: 'morning' });
    crm.getLead.mockResolvedValueOnce({});
    await expect(adapter.getLeadPreferences('lead-1')).resolves.toEqual({});
    await adapter.assignLead('lead-1', 'user-1', actor);
    await adapter.refreshLeadScore('lead-1', actor);
    await adapter.createActivity({} as never, actor);
    await adapter.enqueueCommunication({} as never, actor);
    await adapter.deliverCommunication('communication-1', actor);
    await adapter.changeLeadStatus('lead-1', 'status-1', actor);
    expect(crm.assign).toHaveBeenCalledWith('lead-1', 'user-1', expect.objectContaining({ actorUuid: actor.actorUuid }));
    expect(delivery.deliver).toHaveBeenCalledWith('communication-1', actor.actorUuid);
  });

  it('covers communication delivery success, idempotent path and failure modes', async () => {
    const repository: CommunicationRepository = {
      findByUuid: vi.fn().mockResolvedValue(communication()),
      transitionCommunication: vi.fn().mockImplementation(async (_uuid, status, input) => communication({ status, providerMessageId: input?.providerMessageId ?? null, providerError: input?.providerError ?? null })),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const config = new ConfigService({ EMAIL_PROVIDER_URL: 'https://provider.example.com/send', EMAIL_PROVIDER_TOKEN: 'token' });
    const service = new CrmCommunicationDeliveryService(repository, audit, config);

    const provider = { channel: 'EMAIL' as const, send: vi.fn().mockResolvedValue({ providerMessageId: 'pm-1' }) };
    vi.spyOn((service as unknown as { providers: Map<string, unknown> }).providers, 'get').mockReturnValue(provider);
    await expect(service.deliver(communication().uuid, actor.actorUuid)).resolves.toMatchObject({ status: 'SENT', providerMessageId: 'pm-1' });
    expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: `crm-communication:${communication().uuid}` }));

    repository.findByUuid = vi.fn().mockResolvedValue(communication({ status: 'SENT' }));
    await expect(service.deliver(communication().uuid)).resolves.toMatchObject({ status: 'SENT' });

    repository.findByUuid = vi.fn().mockResolvedValue(null);
    await expect(service.deliver(communication().uuid)).rejects.toBeInstanceOf(NotFoundException);

    repository.findByUuid = vi.fn().mockResolvedValue(communication({ channel: 'FAX' }));
    await expect(service.deliver(communication().uuid)).rejects.toThrow('Unsupported communication channel');

    repository.findByUuid = vi.fn().mockResolvedValue(communication());
    vi.spyOn((service as unknown as { providers: Map<string, unknown> }).providers, 'get').mockReturnValue(undefined);
    await expect(service.deliver(communication().uuid, actor.actorUuid)).rejects.toBeInstanceOf(ProviderNotConfiguredError);
    expect(repository.transitionCommunication).toHaveBeenCalledWith(communication().uuid, 'FAILED', expect.any(Object));

    const retryRepository: CommunicationRepository = {
      findByUuid: vi.fn().mockResolvedValue(communication()),
      transitionCommunication: vi.fn().mockImplementation(async (_uuid, status, input) => communication({ status, providerError: input?.providerError ?? null })),
    };
    const retryAudit = { record: vi.fn().mockResolvedValue(undefined) };
    const retryService = new CrmCommunicationDeliveryService(retryRepository, retryAudit, config);
    const retryProvider = { channel: 'EMAIL' as const, send: vi.fn().mockRejectedValue(new CommunicationProviderError('retry', true, 503)) };
    vi.spyOn((retryService as unknown as { providers: Map<string, unknown> }).providers, 'get').mockReturnValue(retryProvider);
    await expect(retryService.deliver(communication().uuid, actor.actorUuid)).rejects.toBeInstanceOf(CommunicationProviderError);
    expect(retryRepository.transitionCommunication).toHaveBeenCalledWith(communication().uuid, 'QUEUED', expect.objectContaining({ providerError: 'retry' }));

    const permanentRepository: CommunicationRepository = {
      findByUuid: vi.fn().mockResolvedValue(communication()),
      transitionCommunication: vi.fn().mockImplementation(async (_uuid, status, input) => communication({ status, providerError: input?.providerError ?? null })),
    };
    const permanentService = new CrmCommunicationDeliveryService(permanentRepository, audit, config);
    const permanentProvider = { channel: 'EMAIL' as const, send: vi.fn().mockRejectedValue(new CommunicationProviderError('bad', false, 400)) };
    vi.spyOn((permanentService as unknown as { providers: Map<string, unknown> }).providers, 'get').mockReturnValue(permanentProvider);
    await expect(permanentService.deliver(communication().uuid)).rejects.toBeInstanceOf(CommunicationProviderError);
    expect(permanentRepository.transitionCommunication).toHaveBeenCalledWith(communication().uuid, 'FAILED', expect.objectContaining({ providerError: 'bad' }));
  });

  it('covers communication health endpoint states', () => {
    const config = new ConfigService({
      'email.providerUrl': 'https://email.example.com',
      'whatsapp.providerUrl': 'http://wa.example.com',
      'sms.providerUrl': 'https://10.0.0.1',
    });
    const service = new CrmCommunicationHealthService(config);
    const result = service.status();
    expect(result.channels.EMAIL).toEqual({ configured: true, reachable: false, reason: 'health_check_not_executed' });
    expect(result.channels.WHATSAPP).toEqual({ configured: true, reachable: false, reason: 'invalid_provider_endpoint' });
    expect(result.channels.SMS).toEqual({ configured: true, reachable: false, reason: 'invalid_provider_endpoint' });

    const missing = new CrmCommunicationHealthService(new ConfigService());
    expect(missing.status().channels.EMAIL).toEqual({ configured: false, reachable: false, reason: 'provider_not_configured' });

    const malformed = new CrmCommunicationHealthService(new ConfigService({ 'email.providerUrl': 'not-a-url' }));
    expect(malformed.status().channels.EMAIL).toEqual({ configured: true, reachable: false, reason: 'invalid_provider_endpoint' });
  });
});
