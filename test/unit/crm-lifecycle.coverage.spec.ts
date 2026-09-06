import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

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

const depsFactory = () => ({
  crm: {
    score: vi.fn().mockResolvedValue({ score: 90 }),
    activityCreate: vi.fn().mockResolvedValue({ uuid: 'activity-1' }),
    merge: vi.fn().mockResolvedValue({ merged: true }),
    getLead: vi.fn().mockResolvedValue({ uuid: 'lead-1', createdAt: '2026-01-03T00:00:00.000Z' }),
    history: vi.fn().mockResolvedValue({ total: 1, items: [{ uuid: 'h1', createdAt: '2026-01-02T00:00:00.000Z' }] }),
    activityList: vi.fn().mockResolvedValue({ total: 1, items: [{ uuid: 'a1', createdAt: '2026-01-04T00:00:00.000Z' }] }),
    inquiryList: vi.fn().mockResolvedValue({ total: 1, items: [{ uuid: 'i1', createdAt: '2026-01-01T00:00:00.000Z' }] }),
    communicationList: vi.fn().mockResolvedValue({ total: 1, items: [{ uuid: 'c1', createdAt: '2026-01-04T00:00:00.000Z' }] }),
  },
  repo: {
    getScopedLead: vi.fn().mockResolvedValue(lead),
    setLifecycle: vi.fn().mockResolvedValue({ uuid: 'lead-1', statusCode: 'QUALIFIED' }),
    markConverted: vi.fn().mockResolvedValue(undefined),
  },
  lifecycle: { assertCan: vi.fn() },
  qualification: { evaluate: vi.fn().mockReturnValue({ qualified: true, reason: 'score sufficient' }) },
  closure: { decide: vi.fn().mockReturnValue({ outcome: 'WON', reason: 'completed purchase' }) },
  sales: { createFromQualifiedLead: vi.fn().mockResolvedValue({ opportunityUuid: 'opp-1', created: true }) },
  audit: { record: vi.fn().mockResolvedValue(undefined) },
  logger: { info: vi.fn() },
});

describe('CrmLifecycleService coverage', () => {
  let d: ReturnType<typeof depsFactory>;
  let service: CrmLifecycleService;

  beforeEach(() => {
    d = depsFactory();
    service = new CrmLifecycleService(
      d.crm as never,
      d.repo as never,
      d.lifecycle as never,
      d.qualification as never,
      d.closure as never,
      d.sales as never,
      d.audit as never,
      d.logger as never,
    );
  });

  it('rejects inaccessible scoped leads and honors global permissions', async () => {
    d.repo.getScopedLead.mockResolvedValueOnce({ accessible: false, statusCode: 'NEW' });
    await expect(service.nurture('lead-1', { ...actor, permissions: [] })).rejects.toBeInstanceOf(ForbiddenException);
    d.repo.getScopedLead.mockResolvedValueOnce(lead);
    await expect(service.nurture('lead-1', actor)).resolves.toEqual(expect.objectContaining({ uuid: 'lead-1' }));
    expect(d.repo.getScopedLead).toHaveBeenCalledWith('lead-1', actor.actorUuid, true);
  });

  it('qualifies only when qualification policy accepts the scored lead', async () => {
    d.lifecycle.assertCan.mockReturnValueOnce(undefined);
    const result = await service.qualify('lead-1', 'ready for sale', actor);
    expect(result).toEqual(expect.objectContaining({ uuid: 'lead-1' }));
    expect(d.crm.score).toHaveBeenCalledWith('lead-1');
    expect(d.qualification.evaluate).toHaveBeenCalledWith(90, 'ready for sale');
    expect(d.audit.record).toHaveBeenCalled();

    d.qualification.evaluate.mockReturnValueOnce({ qualified: false, reason: 'score too low' });
    await expect(service.qualify('lead-1', 'not ready', actor)).rejects.toThrow(BadRequestException);
  });

  it('nurtures, reactives and creates the nurture workflow activity', async () => {
    await expect(service.nurture('lead-1', actor)).resolves.toEqual(expect.objectContaining({ uuid: 'lead-1' }));
    await expect(service.nurtureWorkflow('lead-1', actor)).resolves.toEqual({
      lead: expect.anything(),
      activity: { uuid: 'activity-1' },
    });
    await expect(service.reactivate('lead-1', actor)).resolves.toEqual(expect.objectContaining({ uuid: 'lead-1' }));
    expect(d.lifecycle.assertCan).toHaveBeenCalledWith('NURTURE', 'NEW');
    expect(d.lifecycle.assertCan).toHaveBeenCalledWith('REACTIVATE', 'NEW');
  });

  it('closes leads according to closure outcome and records the reason', async () => {
    d.closure.decide.mockReturnValueOnce({ outcome: 'WON', reason: 'signed' });
    await expect(service.close('lead-1', 'signed', 'WON', actor)).resolves.toEqual(expect.anything());
    expect(d.repo.setLifecycle).toHaveBeenCalledWith(expect.objectContaining({ toStatus: 'CLOSED_WON', closureOutcome: 'WON' }));

    d.closure.decide.mockReturnValueOnce({ outcome: 'LOST', reason: 'budget' });
    await expect(service.close('lead-1', 'budget', 'LOST', actor)).resolves.toEqual(expect.anything());
    expect(d.repo.setLifecycle).toHaveBeenLastCalledWith(expect.objectContaining({ toStatus: 'CLOSED_LOST', closureOutcome: 'LOST' }));
  });

  it('converts qualified leads and rejects unqualified leads', async () => {
    d.repo.getScopedLead.mockResolvedValueOnce({ ...lead, statusCode: 'QUALIFIED' });
    const result = await service.convert('lead-1', actor, ' conversion-key ');
    expect(result).toEqual({ leadUuid: 'lead-1', opportunityUuid: 'opp-1', created: true });
    expect(d.sales.createFromQualifiedLead).toHaveBeenCalledWith({ leadUuid: 'lead-1', contactUuid: 'contact-1', ownerUserUuid: 'owner-1', idempotencyKey: 'conversion-key' });
    expect(d.repo.markConverted).toHaveBeenCalledWith('lead-1', 'conversion-key');

    d.repo.getScopedLead.mockResolvedValueOnce({ ...lead, statusCode: 'NEW' });
    await expect(service.convert('lead-1', actor)).rejects.toThrow('Lead must be QUALIFIED before conversion');
  });

  it('merges leads only after both source and target are scoped', async () => {
    const result = await service.merge('source', 'target', actor);
    expect(result).toEqual({ merged: true });
    expect(d.repo.getScopedLead).toHaveBeenNthCalledWith(1, 'source', actor.actorUuid, true);
    expect(d.repo.getScopedLead).toHaveBeenNthCalledWith(2, 'target', actor.actorUuid, true);
    expect(d.crm.merge).toHaveBeenCalledWith('source', 'target', actor);
  });

  it('builds a sorted, paginated lead timeline across all sources', async () => {
    const result = await service.timeline('lead-1', { page: 1, limit: 3 }, actor);
    expect(result.total).toBe(5);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(3);
    expect(result.items).toHaveLength(3);
    expect(result.items[0]).toMatchObject({ source: 'ACTIVITY', uuid: 'a1' });
    expect(result.items[1]).toMatchObject({ source: 'COMMUNICATION', uuid: 'c1' });
    expect(result.items[2]).toMatchObject({ source: 'LEAD', uuid: 'lead-1' });
    expect(d.crm.history).toHaveBeenCalledWith('lead-1', expect.objectContaining({ page: 1, limit: 3 }));

    const pageTwo = await service.timeline('lead-1', { page: 2, limit: 2 }, actor);
    expect(pageTwo.page).toBe(2);
    expect(pageTwo.limit).toBe(2);
    expect(pageTwo.items.length).toBeLessThanOrEqual(2);
  });

  it('supports default and bounded timeline pagination', async () => {
    await service.timeline('lead-1', {}, actor);
    expect(d.crm.history).toHaveBeenLastCalledWith('lead-1', expect.objectContaining({ page: 1, limit: 20 }));

    d.repo.getScopedLead.mockResolvedValueOnce({ accessible: false, statusCode: 'NEW' });
    await expect(service.timeline('lead-1', { page: 0, limit: 0 }, { ...actor, permissions: [] })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
