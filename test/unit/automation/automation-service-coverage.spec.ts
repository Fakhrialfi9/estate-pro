import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AutomationService } from '../../../src/modules/automation/application/services/automation.service.js';

const actorUuid = '11111111-1111-4111-8111-111111111111';
const workflowUuid = '22222222-2222-4222-8222-222222222222';
const versionUuid = '33333333-3333-4333-8333-333333333333';
const executionUuid = '44444444-4444-4444-8444-444444444444';
const actionUuid = '55555555-5555-4555-8555-555555555555';

const definition = {
  trigger: { type: 'ENTITY_CREATED', entityType: 'LEAD' },
  graph: {
    entryNodeId: 'action-1',
    nodes: [
      {
        id: 'action-1',
        type: 'ACTION',
        actionType: 'NOTIFY',
        input: { userUuid: actorUuid },
      },
    ],
    edges: [],
  },
};

const activeUser = {
  uuid: actorUuid,
  isActive: true,
  deletedAt: null,
};

const makeRepo = (overrides: Record<string, unknown> = {}) => {
  const base = {
    createWorkflow: vi.fn(async (input: Record<string, unknown>) => input),
    getWorkflow: vi.fn(async () => ({
      uuid: workflowUuid,
      ownerUserUuid: actorUuid,
      status: 'DRAFT',
      activeVersionUuid: null,
      versions: [],
    })),
    updateWorkflow: vi.fn(
      async (_uuid: string, patch: Record<string, unknown>) => ({
        uuid: workflowUuid,
        ...patch,
      }),
    ),
    createVersion: vi.fn(async (input: Record<string, unknown>) => input),
    getVersion: vi.fn(async () => ({
      uuid: versionUuid,
      workflowUuid,
      status: 'DRAFT',
      definition,
      triggerDefinition: definition.trigger,
      version: 1,
    })),
    updateVersion: vi.fn(
      async (_uuid: string, patch: Record<string, unknown>) => ({
        uuid: versionUuid,
        ...patch,
      }),
    ),
    listActiveVersions: vi.fn(async () => []),
    createExecution: vi.fn(async (input: Record<string, unknown>) => input),
    claimDueExecution: vi.fn(async () => null),
    getExecution: vi.fn(async () => ({
      uuid: executionUuid,
      workflowUuid,
      workflowVersionUuid: versionUuid,
      state: 'PENDING',
      currentNodeId: 'action-1',
      contextSnapshot: {},
      actorUuid,
    })),
    updateExecution: vi.fn(
      async (_uuid: string, patch: Record<string, unknown>) => ({
        uuid: executionUuid,
        state: patch.state ?? 'PENDING',
        ...patch,
      }),
    ),
    createAction: vi.fn(async (input: Record<string, unknown>) => ({
      uuid: actionUuid,
      ...input,
    })),
    listActions: vi.fn(async () => []),
    updateAction: vi.fn(
      async (_uuid: string, patch: Record<string, unknown>) => ({
        uuid: actionUuid,
        ...patch,
      }),
    ),
    listWorkflows: vi.fn(async () => ({ items: [], total: 0 })),
    listExecutions: vi.fn(async () => ({ items: [], total: 0 })),
    listNotifications: vi.fn(async () => []),
    markNotificationRead: vi.fn(async () => ({ success: true })),
    createAssignmentRule: vi.fn(
      async (input: Record<string, unknown>) => input,
    ),
    createSlaPolicy: vi.fn(async (input: Record<string, unknown>) => input),
    createEscalationPolicy: vi.fn(
      async (input: Record<string, unknown>) => input,
    ),
    ...overrides,
  };
  return base;
};

const makeUsers = () => ({
  getUser: vi.fn(async () => activeUser),
});

const makeCrm = () => ({
  getLead: vi.fn(async () => ({
    uuid: 'lead-1',
    contactUuid: 'contact-1',
    status: 'NEW',
    source: 'WEB',
    type: 'BUYER',
    ownerUserUuid: actorUuid,
    score: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
  getActivity: vi.fn(async () => ({ uuid: 'activity-1', status: 'OPEN' })),
});

const makeSales = () => ({
  getOpportunity: vi.fn(async () => ({
    uuid: 'opportunity-1',
    leadUuid: 'lead-1',
    contactUuid: 'contact-1',
    ownerUserUuid: actorUuid,
    teamUuid: null,
    pipelineUuid: 'pipeline-1',
    stageUuid: 'stage-1',
    status: 'OPEN',
    title: 'House',
    valueAmount: '100000',
    currency: 'IDR',
    version: 1,
  })),
});

const makeAudit = () => ({
  record: vi.fn(async () => undefined),
});

const makeValidator = () => ({
  checksum: vi.fn(() => 'checksum'),
  validate: vi.fn(() => undefined),
});

const makeService = (
  repoOverrides: Record<string, unknown> = {},
  handlerResult: Record<string, unknown> = {
    success: true,
    output: { ok: true },
  },
) => {
  const repo = makeRepo(repoOverrides);
  const users = makeUsers();
  const crm = makeCrm();
  const sales = makeSales();
  const audit = makeAudit();
  const validator = makeValidator();
  const handler = {
    actionType: 'NOTIFY',
    execute: vi.fn(async () => handlerResult),
  };
  const service = new AutomationService(
    repo as never,
    crm as never,
    sales as never,
    users as never,
    audit as never,
    validator as never,
    [handler],
  );
  return { service, repo, users, crm, sales, audit, validator, handler };
};

describe('AutomationService coverage', () => {
  it('covers workflow lifecycle, ownership and draft versioning', async () => {
    const { service, repo } = makeService();
    expect(
      (
        await service.createWorkflow(
          { name: ' Main ', description: 'Desc', ownerUserUuid: actorUuid },
          actorUuid,
        )
      ).ownerUserUuid,
    ).toBe(actorUuid);
    await expect(
      service.createWorkflow(
        { name: ' ', ownerUserUuid: actorUuid },
        actorUuid,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createWorkflow(
        { name: 'Other', ownerUserUuid: actorUuid },
        '99999999-9999-4999-8999-999999999999',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(
      (
        await service.updateWorkflow(
          workflowUuid,
          { name: 'Updated' },
          actorUuid,
        )
      ).name,
    ).toBe('Updated');
    repo.getWorkflow.mockResolvedValueOnce({
      uuid: workflowUuid,
      ownerUserUuid: actorUuid,
      status: 'ACTIVE',
      versions: [],
    });
    await expect(
      service.updateWorkflow(
        workflowUuid,
        { name: 'Updated' },
        actorUuid,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    const draft = await service.createDraftVersion(
      workflowUuid,
      definition,
      actorUuid,
    );
    expect(draft.version).toBe(1);
    repo.getWorkflow.mockResolvedValueOnce({
      uuid: workflowUuid,
      ownerUserUuid: actorUuid,
      status: 'DRAFT',
      versions: [{ version: 2 }, { version: 5 }],
    });
    const nextDraft = await service.createDraftVersion(
      workflowUuid,
      definition,
      actorUuid,
    );
    expect(nextDraft.version).toBe(6);

    const active = await service.publishActivate(
      workflowUuid,
      versionUuid,
      actorUuid,
    );
    expect(active.activeVersionUuid).toBe(versionUuid);
    await service.pauseWorkflow(workflowUuid, actorUuid);
    await service.archiveWorkflow(workflowUuid, actorUuid);
    expect(repo.updateWorkflow).toHaveBeenCalled();
  });

  it('covers dispatch trigger matching, context resolution and execution creation', async () => {
    const version = {
      uuid: versionUuid,
      workflowUuid,
      status: 'ACTIVE',
      triggerDefinition: definition.trigger,
      definition,
    };
    const { service, repo, crm } = makeService({
      listActiveVersions: vi.fn(async () => [version]),
      getWorkflow: vi.fn(async () => ({
        uuid: workflowUuid,
        ownerUserUuid: actorUuid,
        status: 'ACTIVE',
      })),
    });
    const event = {
      eventId: 'evt-1',
      entityType: 'LEAD',
      entityUuid: 'lead-1',
      action: 'created',
      payload: { email: 'a@example.com' },
      actorUuid,
    };
    const result = await service.dispatch(event);
    expect(result).toHaveLength(1);
    expect(repo.createExecution).toHaveBeenCalledWith(
      expect.objectContaining({ currentNodeId: 'action-1' }),
    );
    expect(crm.getLead).toHaveBeenCalledWith('lead-1');

    const noMatch = await service.dispatch({ ...event, action: 'deleted' });
    expect(noMatch).toEqual([]);
  });

  it('covers cancellation, retry and scoped reads', async () => {
    const { service, repo, audit } = makeService();
    expect(await service.processDue('worker-1')).toBeNull();
    await expect(
      service.retryExecution(executionUuid, actorUuid),
    ).resolves.toMatchObject({ state: 'WAITING' });
    await expect(
      service.cancelExecution(executionUuid, actorUuid),
    ).resolves.toMatchObject({ state: 'CANCELLED' });
    expect(audit.record).toHaveBeenCalled();

    repo.getExecution.mockResolvedValueOnce({
      uuid: executionUuid,
      state: 'SUCCEEDED',
      workflowUuid,
    });
    await expect(
      service.retryExecution(executionUuid, actorUuid),
    ).rejects.toBeInstanceOf(BadRequestException);
    repo.getExecution.mockResolvedValueOnce({
      uuid: executionUuid,
      state: 'SUCCEEDED',
      workflowUuid,
    });
    await expect(
      service.cancelExecution(executionUuid, actorUuid),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(await service.listWorkflows({}, actorUuid)).toEqual({
      items: [],
      total: 0,
    });
    expect(await service.listExecutions({}, actorUuid)).toEqual({
      items: [],
      total: 0,
    });
    expect(
      await service.listNotifications({
        userUuid: actorUuid,
        page: 1,
        limit: 10,
        unreadOnly: true,
      }),
    ).toEqual([]);
    expect(
      await service.markNotificationRead('notification-1', actorUuid),
    ).toEqual({ success: true });
    await expect(
      service.listNotifications({
        userUuid: '',
        page: 1,
        limit: 10,
        unreadOnly: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('covers assignment, SLA, escalation and dashboard rules', async () => {
    const { service, repo } = makeService();
    expect(
      (
        await service.createAssignmentRule(
          workflowUuid,
          {
            name: 'Round robin',
            strategy: 'ROUND_ROBIN',
            criteria: { source: 'WEB' },
          },
          actorUuid,
        )
      ).strategy,
    ).toBe('ROUND_ROBIN');
    await expect(
      service.createAssignmentRule(
        workflowUuid,
        { strategy: 'INVALID' },
        actorUuid,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(
      (
        await service.createSlaPolicy(
          workflowUuid,
          {
            durationMinutes: 60,
            targetEntityType: 'LEAD',
            startEventType: 'created',
            stopEventTypes: ['qualified'],
          },
          actorUuid,
        )
      ).durationMinutes,
    ).toBe(60);
    await expect(
      service.createSlaPolicy(
        workflowUuid,
        {
          durationMinutes: 0,
          targetEntityType: 'LEAD',
          startEventType: 'created',
        },
        actorUuid,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(
      (
        await service.createEscalationPolicy(
          workflowUuid,
          { levels: [{ afterMinutes: 10 }] },
          actorUuid,
        )
      ).maxAttempts,
    ).toBe(3);
    await expect(
      service.createEscalationPolicy(
        workflowUuid,
        { levels: [] },
        actorUuid,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    repo.listWorkflows.mockResolvedValueOnce({ items: [], total: 7 });
    repo.listExecutions.mockResolvedValueOnce({
      items: [
        { state: 'PENDING', attemptCount: 0 },
        { state: 'RUNNING', attemptCount: 1 },
        { state: 'SUCCEEDED', attemptCount: 2 },
        { state: 'FAILED', attemptCount: 0 },
      ],
      total: 4,
    });
    const dashboard = await service.dashboard(actorUuid);
    expect(dashboard.data).toEqual({
      workflowCount: 7,
      executionCount: 4,
      pending: 1,
      running: 1,
      succeeded: 1,
      failed: 1,
      retried: 2,
    });
  });

  it('covers action execution success, retry, failure and missing handler', async () => {
    const baseExecution = {
      uuid: executionUuid,
      workflowUuid,
      workflowVersionUuid: versionUuid,
      state: 'PENDING',
      currentNodeId: 'action-1',
      contextSnapshot: {},
      actorUuid,
    };

    const success = makeService({
      getExecution: vi.fn(async () => baseExecution),
      listActions: vi.fn(async () => []),
      claimDueExecution: vi.fn(async () => baseExecution),
    });
    const processed = await success.service.processDue('worker-1');
    expect(processed).toMatchObject({ state: 'SUCCEEDED' });

    const retry = makeService(
      {},
      {
        success: false,
        retryable: true,
        errorCode: 'TEMPORARY',
        errorMessage: 'temporary failure',
      },
    );
    retry.repo.claimDueExecution.mockResolvedValueOnce(baseExecution);
    const retryResult = await retry.service.processDue('worker-1');
    expect(retryResult).toMatchObject({ state: 'WAITING' });

    const fail = makeService(
      {},
      {
        success: false,
        retryable: false,
        errorCode: 'FAILED',
        errorMessage: 'permanent failure',
      },
    );
    fail.repo.claimDueExecution.mockResolvedValueOnce(baseExecution);
    const failResult = await fail.service.processDue('worker-1');
    expect(failResult).toMatchObject({ state: 'FAILED' });

    const unsupported = makeService();
    unsupported.repo.claimDueExecution.mockResolvedValueOnce(baseExecution);
    unsupported.repo.getVersion.mockResolvedValueOnce({
      uuid: versionUuid,
      workflowUuid,
      definition: {
        trigger: definition.trigger,
        graph: {
          entryNodeId: 'missing-action',
          nodes: [],
          edges: [],
        },
      },
    });
    const unsupportedResult = await unsupported.service.processDue('worker-1');
    expect(unsupportedResult).toMatchObject({ state: 'FAILED' });
  });

  it('rejects missing resources and inactive capability targets', async () => {
    const missing = makeService({
      getWorkflow: vi.fn(async () => null),
      getExecution: vi.fn(async () => null),
    });
    await expect(
      missing.service.getWorkflow(workflowUuid, actorUuid),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      missing.service.getExecution(executionUuid, actorUuid),
    ).rejects.toBeInstanceOf(NotFoundException);

    const inactive = makeService();
    inactive.users.getUser.mockResolvedValueOnce({
      uuid: actorUuid,
      isActive: false,
      deletedAt: null,
    });
    await expect(
      inactive.service.createWorkflow(
        { name: 'Flow', ownerUserUuid: actorUuid },
        actorUuid,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
