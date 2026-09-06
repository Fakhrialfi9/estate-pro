import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CrmLifecycleService } from '../../src/modules/crm/application/crm-lifecycle.service.js';

const actor = {
  actorUuid: 'actor-1',
  permissions: ['crm.leads.manage'],
  requestId: 'req-1',
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
};
const lead = {
  accessible: true,
  statusCode: 'NEW',
  contactUuid: 'contact-1',
  ownerUserUuid: 'owner-1',
};

const dependencies = () => ({
  crm: {
    score: vi.fn().mockResolvedValue({ score: 90 }),
    activityCreate: vi.fn().mockResolvedValue({ uuid: 'activity-1' }),
    merge: vi.fn().mockResolvedValue({ merged: true }),
    getLead: vi.fn().mockResolvedValue({
      uuid: 'lead-1',
      createdAt: '2026-01-03T00:00:00.000Z',
    }),
    history: vi.fn().mockResolvedValue({
      total: 1,
      items: [{ uuid: 'h1', createdAt: '2026-01-02T00:00:00.000Z' }],
    }),
    activityList: vi.fn().mockResolvedValue({
      total: 1,
      items: [{ uuid: 'a1', createdAt: '2026-01-04T00:00:00.000Z' }],
    }),
    inquiryList: vi.fn().mockResolvedValue({
      total: 1,
      items: [{ uuid: 'i1', createdAt: '2026-01-01T00:00:00.000Z' }],
    }),
    communicationList: vi.fn().mockResolvedValue({
      total: 1,
      items: [{ uuid: 'c1', createdAt: '2026-01-04T00:00:00.000Z' }],
    }),
  },
  repo: {
    getScopedLead: vi.fn().mockResolvedValue(lead),
    setLifecycle: vi.fn().mockResolvedValue({
      uuid: 'lead-1',
      statusCode: 'QUALIFIED',
    }),
    markConverted: vi.fn().mockResolvedValue(undefined),
  },
  lifecycle: { assertCan: vi.fn() },
  qualification: {
    evaluate: vi.fn().mockReturnValue({
      qualified: true,
      reason: 'score sufficient',
    }),
  },
  closure: {
    decide: vi.fn().mockReturnValue({
      outcome: 'WON',
      reason: 'completed purchase',
    }),
  },
  sales: {
    createFromQualifiedLead: vi.fn().mockResolvedValue({
      opportunityUuid: 'opp-1',
      created: true,
    }),
  },
  audit: { record: vi.fn().mockResolvedValue(undefined) },
  logger: { info: vi.fn() },
});

describe('CrmLifecycleService coverage', () => {
  let d: ReturnType<typeof dependencies>;
  let service: CrmLifecycleService;

  beforeEach(() => {
    d = dependencies();
    service = new CrmLifecycleService(
      d.crm as never,
      d.repo as never,
      d.lifecycle,
      d.qualification,
      d.closure,
      d.sales,
      d.audit,
      d.logger as never,
    );
  });

  it('covers scoped access and nurture', async () => {
    d.repo.getScopedLead.mockResolvedValueOnce({
      accessible: false,
      statusCode: 'NEW',
    });
    await expect(
      service.nurture('lead-1', { ...actor, permissions: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    d.repo.getScopedLead.mockResolvedValueOnce(lead);
    await expect(service.nurture('lead-1', actor)).resolves.toEqual(
      expect.objectContaining({ uuid: 'lead-1' }),
    );
    expect(d.repo.getScopedLead).toHaveBeenCalledWith(
      'lead-1',
      actor.actorUuid,
      true,
    );
  });

  it('covers qualification allow and reject paths', async () => {
    await expect(
      service.qualify('lead-1', 'ready for sale', actor),
    ).resolves.toEqual(expect.objectContaining({ uuid: 'lead-1' }));
    expect(d.crm.score).toHaveBeenCalledWith('lead-1');
    expect(d.qualification.evaluate).toHaveBeenCalledWith(90, 'ready for sale');
    expect(d.audit.record).toHaveBeenCalled();

    d.qualification.evaluate.mockReturnValueOnce({
      qualified: false,
      reason: 'score too low',
    });
    await expect(service.qualify('lead-1', 'not ready', actor)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('covers nurture workflow and reactivation', async () => {
    await expect(service.nurtureWorkflow('lead-1', actor)).resolves.toEqual({
      lead: expect.anything(),
      activity: { uuid: 'activity-1' },
    });
    await expect(service.reactivate('lead-1', actor)).resolves.toEqual(
      expect.objectContaining({ uuid: 'lead-1' }),
    );
    expect(d.lifecycle.assertCan).toHaveBeenCalledWith('REACTIVATE', 'NEW');
  });

  it('covers closed-won and closed-lost lifecycle decisions', async () => {
    d.closure.decide.mockReturnValueOnce({
      outcome: 'WON',
      reason: 'signed',
    });
    await expect(
      service.close('lead-1', 'signed', 'WON', actor),
    ).resolves.toBeDefined();
    expect(d.repo.setLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        toStatus: 'CLOSED_WON',
        closureOutcome: 'WON',
      }),
    );

    d.closure.decide.mockReturnValueOnce({
      outcome: 'LOST',
      reason: 'budget',
    });
    await expect(
      service.close('lead-1', 'budget', 'LOST', actor),
    ).resolves.toBeDefined();
    expect(d.repo.setLifecycle).toHaveBeenLastCalledWith(
      expect.objectContaining({
        toStatus: 'CLOSED_LOST',
        closureOutcome: 'LOST',
      }),
    );
  });

  it('covers qualified conversion and rejected conversion', async () => {
    d.repo.getScopedLead.mockResolvedValueOnce({
      ...lead,
      statusCode: 'QUALIFIED',
    });
    await expect(
      service.convert('lead-1', actor, ' conversion-key '),
    ).resolves.toEqual({
      leadUuid: 'lead-1',
      opportunityUuid: 'opp-1',
      created: true,
    });
    expect(d.sales.createFromQualifiedLead).toHaveBeenCalledWith({
      leadUuid: 'lead-1',
      contactUuid: 'contact-1',
      ownerUserUuid: 'owner-1',
      idempotencyKey: 'conversion-key',
    });
    expect(d.repo.markConverted).toHaveBeenCalledWith(
      'lead-1',
      'conversion-key',
    );

    d.repo.getScopedLead.mockResolvedValueOnce({
      ...lead,
      statusCode: 'NEW',
    });
    await expect(service.convert('lead-1', actor)).rejects.toThrow(
      'Lead must be QUALIFIED before conversion',
    );
  });

  it('covers merge and timeline pagination', async () => {
    await expect(service.merge('source', 'target', actor)).resolves.toEqual({
      merged: true,
    });
    expect(d.crm.merge).toHaveBeenCalledWith('source', 'target', actor);

    await expect(
      service.timeline('lead-1', { page: 1, limit: 3 }, actor),
    ).resolves.toMatchObject({
      total: 5,
      items: [
        expect.objectContaining({ source: 'ACTIVITY', uuid: 'a1' }),
        expect.objectContaining({ source: 'COMMUNICATION', uuid: 'c1' }),
        expect.objectContaining({ source: 'LEAD', uuid: 'lead-1' }),
      ],
    });

    await expect(
      service.timeline('lead-1', { page: 2, limit: 2 }, actor),
    ).resolves.toMatchObject({ page: 2, limit: 2 });
  });
});
