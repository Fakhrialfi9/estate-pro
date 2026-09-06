import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SalesService } from '../../../src/modules/sales/application/sales.service.js';
import type { SalesRepository } from '../../../src/modules/sales/domain/repositories/sales.repository.js';
import type {
  SalesActor,
  SalesOpportunityRow,
} from '../../../src/modules/sales/domain/sales.types.js';

const actor: SalesActor = {
  actorUuid: '11111111-1111-4111-8111-111111111111',
  permissions: ['sales.opportunities.read'],
  requestId: 'request-1',
  ipAddress: '127.0.0.1',
  userAgent: 'unit-test',
};

const opportunity = (
  overrides: Partial<SalesOpportunityRow> = {},
): SalesOpportunityRow => ({
  uuid: '22222222-2222-4222-8222-222222222222',
  leadUuid: '33333333-3333-4333-8333-333333333333',
  contactUuid: '44444444-4444-4444-8444-444444444444',
  ownerUserUuid: actor.actorUuid,
  teamUuid: null,
  pipelineUuid: null,
  stageUuid: null,
  status: 'OPEN',
  propertyUuid: null,
  title: 'Qualified lead',
  valueAmount: '100.00',
  currency: 'USD',
  version: 3,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  ...overrides,
});

describe('SalesService', () => {
  const repository = {
    createPipeline: vi.fn(),
    listPipelines: vi.fn(),
    getPipeline: vi.fn(),
    updatePipeline: vi.fn(),
    getOpportunity: vi.fn(),
    listOpportunities: vi.fn(),
    updateOpportunity: vi.fn(),
    transitionOpportunity: vi.fn(),
    getNegotiation: vi.fn(),
    transitionNegotiation: vi.fn(),
    getDeal: vi.fn(),
    listDeals: vi.fn(),
  } satisfies Record<
    keyof SalesRepository,
    ReturnType<typeof vi.fn>
  >;
  const auditRecord = vi.fn().mockResolvedValue(undefined);
  const service = new SalesService(repository, {
    record: auditRecord,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    repository.getOpportunity.mockResolvedValue(opportunity());
    repository.getPipeline.mockResolvedValue({ uuid: 'pipeline-1' });
    repository.createPipeline.mockResolvedValue({ uuid: 'pipeline-1' });
    repository.updatePipeline.mockResolvedValue({ uuid: 'pipeline-1' });
    repository.listOpportunities.mockResolvedValue({
      items: [opportunity()],
      total: 1,
      page: 1,
      limit: 20,
    });
    repository.updateOpportunity.mockResolvedValue(opportunity({ version: 4 }));
    repository.transitionOpportunity.mockResolvedValue(
      opportunity({ status: 'QUALIFIED' }),
    );
    repository.getNegotiation.mockResolvedValue({
      uuid: '55555555-5555-4555-8555-555555555555',
      status: 'OPEN',
    });
    repository.transitionNegotiation.mockResolvedValue({
      uuid: 'negotiation-1',
    });
    repository.getDeal.mockResolvedValue({
      uuid: '66666666-6666-4666-8666-666666666666',
      ownerUserUuid: actor.actorUuid,
      status: 'OPEN',
      version: 1,
    });
    repository.listDeals.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });
  });

  it('creates a pipeline and records the authenticated audit event', async () => {
    await expect(
      service.createPipeline(
        { name: ' Residential ' },
        {
          ...actor,
          permissions: ['sales.pipelines.create'],
        },
      ),
    ).resolves.toEqual({ uuid: 'pipeline-1' });

    expect(repository.createPipeline).toHaveBeenCalledWith({
      name: ' Residential ',
    });
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SALES_PIPELINE_CREATED',
        entityType: 'sales_pipeline',
        entityUuid: 'pipeline-1',
        actorUuid: actor.actorUuid,
        requestId: actor.requestId,
      }),
    );
  });

  it('rejects invalid input and unauthorized access before persistence', async () => {
    await expect(
      service.createPipeline(
        { name: ' ' },
        {
          ...actor,
          permissions: ['sales.pipelines.create'],
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createPipeline).not.toHaveBeenCalled();

    await expect(service.listPipelines({}, actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repository.listPipelines).not.toHaveBeenCalled();
  });

  it('returns a pipeline and reports missing or malformed identifiers', async () => {
    const readActor = {
      ...actor,
      permissions: ['sales.pipelines.read'],
    };
    await expect(
      service.getPipeline('pipeline-1', readActor),
    ).rejects.toBeInstanceOf(BadRequestException);

    repository.getPipeline.mockResolvedValueOnce(null);
    await expect(
      service.getPipeline('77777777-7777-4777-8777-777777777777', readActor),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('scopes opportunity and deal lists to the actor without sales.manage', async () => {
    await service.listOpportunities({ page: 2, limit: 10 }, actor);
    expect(repository.listOpportunities).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      ownerUserUuid: actor.actorUuid,
    });

    const manager = { ...actor, permissions: ['sales.manage'] };
    await service.listDeals({ page: 3 }, manager);
    expect(repository.listDeals).toHaveBeenCalledWith({ page: 3 });
  });

  it('updates an owned opportunity with its version and audits the update', async () => {
    const updateActor = {
      ...actor,
      permissions: ['sales.opportunities.read', 'sales.opportunities.update'],
    };
    await service.updateOpportunity(
      opportunity().uuid,
      { version: 3, title: 'Updated title' },
      updateActor,
    );

    expect(repository.updateOpportunity).toHaveBeenCalledWith(
      opportunity().uuid,
      { version: 3, title: 'Updated title' },
    );
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SALES_OPPORTUNITY_UPDATED' }),
    );
  });

  it('rejects an opportunity transition that is not allowed', async () => {
    repository.getOpportunity.mockResolvedValueOnce(
      opportunity({ status: 'WON' }),
    );
    const transitionActor = {
      ...actor,
      permissions: [
        'sales.opportunities.read',
        'sales.opportunities.transition',
      ],
    };

    await expect(
      service.transitionOpportunity(
        opportunity().uuid,
        'LOST',
        transitionActor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.transitionOpportunity).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it('transitions a negotiation and audits the resulting state change', async () => {
    const transitionActor = {
      ...actor,
      permissions: ['sales.negotiations.transition'],
    };
    await service.negotiationStatus(
      '55555555-5555-4555-8555-555555555555',
      'ACTIVE',
      transitionActor,
    );

    expect(repository.transitionNegotiation).toHaveBeenCalledWith(
      '55555555-5555-4555-8555-555555555555',
      'ACTIVE',
      transitionActor,
    );
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SALES_NEGOTIATION_STATUS_CHANGED' }),
    );
  });

  it('rejects missing negotiations and owner-scoped records', async () => {
    repository.getNegotiation.mockResolvedValueOnce(null);
    await expect(
      service.negotiationStatus(
        '55555555-5555-4555-8555-555555555555',
        'ACTIVE',
        {
          ...actor,
          permissions: [
            'sales.negotiations.read',
            'sales.negotiations.transition',
          ],
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    repository.getOpportunity.mockResolvedValueOnce(
      opportunity({ ownerUserUuid: '88888888-8888-4888-8888-888888888888' }),
    );
    await expect(
      service.getOpportunity(opportunity().uuid, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
