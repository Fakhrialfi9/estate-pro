import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SalesService } from '../../../src/modules/sales/application/sales.service.js';
import { describe, expect, it, vi } from 'vitest';

const uuid = '11111111-1111-4111-8111-111111111111';
const actor = {
  actorUuid: uuid,
  permissions: ['sales.manage'],
  requestId: 'req-1',
} as const;

const makeRepo = () =>
  new Proxy(
    {},
    {
      get: (_target, property) => {
        const name = String(property);
        if (name === 'getOpportunity')
          return vi.fn(() =>
            Promise.resolve({
              uuid,
              ownerUserUuid: uuid,
              status: 'OPEN',
              version: 1,
            }),
          );
        if (name === 'getDeal')
          return vi.fn(() =>
            Promise.resolve({
              uuid,
              ownerUserUuid: uuid,
              status: 'OPEN',
              version: 1,
            }),
          );
        if (name === 'getNegotiation')
          return vi.fn(() => Promise.resolve({ uuid, status: 'OPEN' }));
        if (
          name === 'createPipeline' ||
          name === 'createStage' ||
          name === 'createOpportunity' ||
          name === 'updatePipeline' ||
          name === 'updateStage' ||
          name === 'createActivity' ||
          name === 'createViewing' ||
          name === 'createNegotiation' ||
          name === 'transitionNegotiation' ||
          name === 'createOffer' ||
          name === 'transitionOffer' ||
          name === 'createDeal' ||
          name === 'addDealItem' ||
          name === 'updateDealItem' ||
          name === 'transitionDeal' ||
          name === 'closeDeal' ||
          name === 'markLost' ||
          name === 'createLostReason' ||
          name === 'updateLostReason' ||
          name === 'createCommissionRule' ||
          name === 'calculateCommission' ||
          name === 'approveCommission' ||
          name === 'settleCommission' ||
          name === 'reopenDeal' ||
          name === 'assignOpportunity'
        )
          return vi.fn(() =>
            Promise.resolve({
              uuid,
              version: 2,
              status: 'OPEN',
              ownerUserUuid: uuid,
            }),
          );
        if (
          name === 'listPipelines' ||
          name === 'listStages' ||
          name === 'listStageHistory' ||
          name === 'listActivities' ||
          name === 'listViewings' ||
          name === 'listOffers' ||
          name === 'listDeals' ||
          name === 'listNegotiationHistory' ||
          name === 'listLostReasons' ||
          name === 'commissionReport'
        )
          return vi.fn(() => Promise.resolve([]));
        if (
          name === 'updateOpportunity' ||
          name === 'updateViewingStatus' ||
          name === 'updateActivityStatus' ||
          name === 'reorderStages' ||
          name === 'removeDealItem'
        )
          return vi.fn(() => Promise.resolve({ uuid, version: 2 }));
        if (name === 'listOpportunities') return vi.fn(() => Promise.resolve([]));
        if (name === 'forecast')
          return vi.fn(() => Promise.resolve({ total: '0.0000' }));
        return vi.fn(() => Promise.resolve({ uuid }));
      },
    },
  ) as never;

const makeAudit = () =>
  ({ record: vi.fn(() => Promise.resolve(undefined)) }) as never;
const service = () => new SalesService(makeRepo(), makeAudit());

const noPermission = { actorUuid: uuid, permissions: [] } as const;

describe('SalesService coverage', () => {
  it('covers pipeline and stage management', async () => {
    const s = service();
    expect((await s.createPipeline({ name: ' Main ' }, actor)).uuid).toBe(uuid);
    expect(await s.listPipelines({}, actor)).toEqual([]);
    expect((await s.getPipeline(uuid, actor)).uuid).toBe(uuid);
    expect(
      (await s.updatePipeline(uuid, { name: 'Updated' }, actor)).uuid,
    ).toBe(uuid);
    expect((await s.archivePipeline(uuid, actor)).uuid).toBe(uuid);
    expect(
      (
        await s.createStage(
          { pipelineUuid: uuid, code: 'OPEN', name: 'Open', probability: 10 },
          actor,
        )
      ).uuid,
    ).toBe(uuid);
    expect(await s.listStages(uuid, actor)).toEqual([]);
    expect((await s.updateStage(uuid, { probability: 20 }, actor)).uuid).toBe(
      uuid,
    );
    expect((await s.archiveStage(uuid, actor)).uuid).toBe(uuid);
    expect((await s.reorderStages(uuid, [uuid], actor)).uuid).toBe(uuid);
    await expect(s.createPipeline({ name: ' ' }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      s.createStage(
        { pipelineUuid: 'bad', code: 'X', name: 'X', probability: 10 },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      s.createStage(
        { pipelineUuid: uuid, code: 'X', name: 'X', probability: 101 },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('covers opportunity ownership, transitions, property association and activities', async () => {
    const s = service();
    const input = {
      leadUuid: uuid,
      contactUuid: uuid,
      title: 'House',
      idempotencyKey: 'id-1',
      valueAmount: '100.25',
      currency: 'IDR',
    };
    expect((await s.createOpportunity(input, actor)).uuid).toBe(uuid);
    expect((await s.getOpportunity(uuid, actor)).status).toBe('OPEN');
    expect(await s.listOpportunities({}, actor)).toEqual([]);
    expect(
      (await s.updateOpportunity(uuid, { version: 1, title: 'New' }, actor))
        .uuid,
    ).toBe(uuid);
    expect(
      (await s.assignOpportunity(uuid, { ownerUserUuid: uuid }, actor)).uuid,
    ).toBe(uuid);
    expect(
      (await s.transitionOpportunity(uuid, 'QUALIFIED', actor, 'qualify')).uuid,
    ).toBe(uuid);
    expect((await s.attachProperty(uuid, uuid, actor)).uuid).toBe(uuid);
    expect((await s.detachProperty(uuid, actor)).uuid).toBe(uuid);
    expect(await s.stageHistory(uuid, {}, actor)).toEqual([]);
    expect(
      (
        await s.createActivity(
          { opportunityUuid: uuid, type: 'CALL', subject: 'Call' },
          actor,
        )
      ).uuid,
    ).toBe(uuid);
    expect((await s.activityStatus(uuid, 'COMPLETED', actor)).uuid).toBe(uuid);
    expect(await s.listActivities({}, actor)).toEqual([]);
    expect(await s.listActivities({ opportunityUuid: uuid }, actor)).toEqual(
      [],
    );
    expect(
      (
        await s.createViewing(
          {
            opportunityUuid: uuid,
            propertyUuid: uuid,
            contactUuid: uuid,
            scheduledAt: new Date(Date.now() + 120000).toISOString(),
          },
          actor,
        )
      ).uuid,
    ).toBe(uuid);
    expect(
      (await s.viewingStatus(uuid, 'CONFIRMED', undefined, actor)).uuid,
    ).toBe(uuid);
    expect(await s.listViewings({}, actor)).toEqual([]);
    await expect(
      s.createOpportunity({ ...input, leadUuid: 'bad' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      s.createOpportunity({ ...input, title: ' ' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      s.createOpportunity({ ...input, currency: 'ID' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      s.transitionOpportunity(uuid, 'ARCHIVED', actor),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      s.createViewing(
        {
          opportunityUuid: uuid,
          propertyUuid: uuid,
          contactUuid: uuid,
          scheduledAt: new Date(Date.now() - 120000).toISOString(),
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('covers negotiation, offers, deals, closing, lost reasons, commission and forecast', async () => {
    const s = service();
    expect(
      (
        await s.startNegotiation(
          { opportunityUuid: uuid, openedByUuid: uuid },
          actor,
        )
      ).uuid,
    ).toBe(uuid);
    expect((await s.negotiationStatus(uuid, 'ACTIVE', actor)).uuid).toBe(uuid);
    expect(await s.negotiationHistory(uuid, actor)).toEqual([]);
    expect(
      (
        await s.createOffer(
          {
            negotiationUuid: uuid,
            amount: '1000',
            currency: 'IDR',
            expiresAt: new Date(Date.now() + 120000).toISOString(),
          },
          actor,
        )
      ).uuid,
    ).toBe(uuid);
    expect((await s.offerStatus(uuid, 'SUBMITTED', actor)).uuid).toBe(uuid);
    expect(await s.offers(uuid, actor)).toEqual([]);
    expect(
      (
        await s.createDeal(
          { opportunityUuid: uuid, offerUuid: uuid, idempotencyKey: 'deal-1' },
          actor,
        )
      ).uuid,
    ).toBe(uuid);
    expect((await s.getDeal(uuid, actor)).uuid).toBe(uuid);
    expect(await s.listDeals({}, actor)).toEqual([]);
    expect(
      (
        await s.addDealItem(
          uuid,
          {
            description: 'Item',
            quantity: 1,
            unitAmount: '100',
            currency: 'IDR',
          },
          actor,
        )
      ).uuid,
    ).toBe(uuid);
    expect(
      (await s.updateDealItem(uuid, { quantity: 2, unitAmount: '150' }, actor))
        .uuid,
    ).toBe(uuid);
    await s.removeDealItem(uuid, actor);
    expect((await s.dealStatus(uuid, 'IN_PROGRESS', actor)).uuid).toBe(uuid);
    expect(
      (
        await s.closeDeal(
          uuid,
          {
            method: 'BANK',
            closedAt: new Date().toISOString(),
            idempotencyKey: 'close-1',
          },
          actor,
        )
      ).uuid,
    ).toBe(uuid);
    expect((await s.lostOpportunity(uuid, uuid, actor)).uuid).toBe(uuid);
    expect((await s.lostDeal(uuid, uuid, actor)).uuid).toBe(uuid);
    expect(s.reopenDeal(uuid, 'Customer request', actor)).toEqual({ uuid });
    expect(await s.lostReasons(actor)).toEqual([]);
    expect(
      (await s.createLostReason({ code: 'PRICE', name: 'Price' }, actor)).uuid,
    ).toBe(uuid);
    expect(
      (await s.updateLostReason(uuid, { name: 'Updated' }, actor)).uuid,
    ).toBe(uuid);
    expect(
      (
        await s.createCommissionRule(
          { code: 'STD', name: 'Standard', ratePercent: '5' },
          actor,
        )
      ).uuid,
    ).toBe(uuid);
    expect(
      (
        await s.calculateCommission(
          uuid,
          { ruleUuid: uuid, idempotencyKey: 'c-1' },
          actor,
        )
      ).uuid,
    ).toBe(uuid);
    expect((await s.approveCommission(uuid, actor)).uuid).toBe(uuid);
    expect((await s.settleCommission(uuid, actor)).uuid).toBe(uuid);
    expect(await s.commissionReport({}, actor)).toEqual([]);
    expect(await s.forecast({}, actor)).toEqual({ total: '0.0000' });
    await expect(
      s.createDeal({ opportunityUuid: uuid, idempotencyKey: 'x' }, actor),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      s.createOffer(
        {
          negotiationUuid: uuid,
          amount: '10',
          currency: 'IDR',
          expiresAt: new Date(Date.now() - 1).toISOString(),
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(s.reopenDeal(uuid, ' ', actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      s.closeDeal(
        uuid,
        { method: 'BANK', closedAt: 'invalid', idempotencyKey: 'x' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces permissions and ownership boundaries', async () => {
    const s = service();
    await expect(
      s.createPipeline({ name: 'x' }, noPermission),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const ownerScoped = {
      actorUuid: uuid,
      permissions: ['sales.opportunities.read', 'sales.deals.read'],
    } as const;
    expect(await s.listOpportunities({}, ownerScoped)).toEqual([]);
    expect(await s.listDeals({}, ownerScoped)).toEqual([]);
    const repo = makeRepo() as Record<string, ReturnType<typeof vi.fn>>;
    repo.getOpportunity = vi.fn(() =>
      Promise.resolve({
        uuid,
        ownerUserUuid: '22222222-2222-4222-8222-222222222222',
        status: 'OPEN',
        version: 1,
      }),
    );
    const isolated = new SalesService(repo as never, makeAudit());
    await expect(
      isolated.getOpportunity(uuid, ownerScoped),
    ).rejects.toBeInstanceOf(ForbiddenException);
    repo.getOpportunity = vi.fn(() => Promise.resolve(null));
    await expect(isolated.getOpportunity(uuid, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
