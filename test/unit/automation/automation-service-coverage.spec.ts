import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { AutomationCrmPort } from '../../../src/common/contracts/automation-crm.port.js';
import type { AutomationSalesPort } from '../../../src/common/contracts/automation-sales.port.js';
import type { ActionHandler } from '../../../src/modules/automation/domain/automation.ports.js';
import { AutomationService } from '../../../src/modules/automation/application/services/automation.service.js';
import type { WorkflowValidator } from '../../../src/modules/automation/application/validation/workflow-validator.js';

type HandlerResult = {
  success: boolean;
  retryable: boolean;
  output?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
};

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
  status: 'ACTIVE',
  isActive: true,
  deletedAt: null,
};

const makeRepo = (overrides: Record<string, unknown> = {}) => {
  const base = {
    createWorkflow: vi.fn(() =>
      Promise.resolve({
        uuid: workflowUuid,
        name: 'Main',
        ownerUserUuid: actorUuid,
      }),
    ),
    getWorkflow: vi.fn(() =>
      Promise.resolve({
        uuid: workflowUuid,
        ownerUserUuid: actorUuid,
        status: 'DRAFT',
        activeVersionUuid: null,
        versions: [],
      }),
    ),
    updateWorkflow: vi.fn((_uuid: string, patch: Record<string, unknown>) =>
      Promise.resolve({
        uuid: workflowUuid,
        ...patch,
      }),
    ),
    createVersion: vi.fn((input: Record<string, unknown>) =>
      Promise.resolve({
        uuid: versionUuid,
        ...input,
      }),
    ),
    getVersion: vi.fn(() =>
      Promise.resolve({
        uuid: versionUuid,
        workflowUuid,
        status: 'DRAFT',
        definition,
        triggerDefinition: definition.trigger,
        version: 1,
      }),
    ),
    updateVersion: vi.fn((_uuid: string, patch: Record<string, unknown>) =>
      Promise.resolve({
        uuid: versionUuid,
        ...patch,
      }),
    ),
    listActiveVersions: vi.fn(() => Promise.resolve([])),
    createExecution: vi.fn((input: Record<string, unknown>) =>
      Promise.resolve(input),
    ),
    claimDueExecution: vi.fn(() => Promise.resolve(null)),
    getExecution: vi.fn(() =>
      Promise.resolve({
        uuid: executionUuid,
        workflowUuid,
        workflowVersionUuid: versionUuid,
        state: 'PENDING',
        currentNodeId: 'action-1',
        contextSnapshot: {},
        actorUuid,
      }),
    ),
    updateExecution: vi.fn((_uuid: string, patch: Record<string, unknown>) =>
      Promise.resolve({
        uuid: executionUuid,
        state: patch.state ?? 'PENDING',
        ...patch,
      }),
    ),
    createAction: vi.fn((input: Record<string, unknown>) =>
      Promise.resolve({
        uuid: actionUuid,
        ...input,
      }),
    ),
    getAction: vi.fn(() => Promise.resolve(null)),
    listActions: vi.fn(() => Promise.resolve([])),
    updateAction: vi.fn((_uuid: string, patch: Record<string, unknown>) =>
      Promise.resolve({
        uuid: actionUuid,
        ...patch,
      }),
    ),
    claimDueAction: vi.fn(() => Promise.resolve(null)),
    reclaimExpired: vi.fn(() => Promise.resolve(0)),
    countRecentActionExecutions: vi.fn(() => Promise.resolve(0)),
    listWorkflows: vi.fn(() =>
      Promise.resolve({ items: [], total: 0, page: 1, limit: 25 }),
    ),
    listExecutions: vi.fn(() =>
      Promise.resolve({ items: [], total: 0, page: 1, limit: 25 }),
    ),
    listNotifications: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
    markNotificationRead: vi.fn(() => Promise.resolve({ success: true })),
    createAssignmentRule: vi.fn((input: Record<string, unknown>) =>
      Promise.resolve(input),
    ),
    createSlaPolicy: vi.fn((input: Record<string, unknown>) =>
      Promise.resolve(input),
    ),
    createSlaInstance: vi.fn((input: Record<string, unknown>) =>
      Promise.resolve(input),
    ),
    claimDueSla: vi.fn(() => Promise.resolve(null)),
    updateSlaInstance: vi.fn((_uuid: string, patch: Record<string, unknown>) =>
      Promise.resolve(patch),
    ),
    createEscalationPolicy: vi.fn((input: Record<string, unknown>) =>
      Promise.resolve(input),
    ),
    getEscalationPolicy: vi.fn(() => Promise.resolve(null)),
    createNotification: vi.fn((input: Record<string, unknown>) =>
      Promise.resolve(input),
    ),
  };

  return { ...base, ...overrides };
};

const makeUsers = () => ({
  getUser: vi.fn(() => Promise.resolve(activeUser)),
});

const makeCrm = () => ({
  getLead: vi.fn(() =>
    Promise.resolve({
      uuid: 'lead-1',
      contactUuid: 'contact-1',
      status: 'NEW',
      source: 'WEB',
      type: 'BUYER',
      ownerUserUuid: actorUuid,
      score: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  ),
  getActivity: vi.fn(() =>
    Promise.resolve({ uuid: 'activity-1', status: 'OPEN' }),
  ),
});

const makeSales = () => ({
  getOpportunity: vi.fn(() =>
    Promise.resolve({
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
    }),
  ),
});

const makeAudit = () => ({
  record: vi.fn(() => Promise.resolve(undefined)),
});

const makeValidator = () => ({
  checksum: vi.fn(() => 'checksum'),
  validate: vi.fn(() => definition),
});

const makeService = (
  repoOverrides: Record<string, unknown> = {},
  handlerResult: HandlerResult = {
    success: true,
    retryable: false,
    output: { ok: true },
  },
) => {
  const repo = makeRepo(repoOverrides);
  const users = makeUsers();
  const crm = makeCrm();
  const sales = makeSales();
  const audit = makeAudit();
  const validator = makeValidator() as unknown as WorkflowValidator;
  const handler: ActionHandler = {
    actionType: 'NOTIFY',
    execute: vi.fn(() => Promise.resolve(handlerResult)),
  };

  const service = new AutomationService(
    repo,
    crm as unknown as AutomationCrmPort,
    sales as unknown as AutomationSalesPort,
    users,
    audit,
    validator,
    [handler],
  );

  return { service, repo, users, crm, sales, audit, validator, handler };
};

describe('AutomationService coverage', () => {
  it('covers workflow lifecycle, ownership and draft versioning', async () => {
    const { service, repo } = makeService();

    await expect(
      service.createWorkflow(
        { name: ' Main ', description: 'Desc', ownerUserUuid: actorUuid },
        actorUuid,
      ),
    ).resolves.toMatchObject({
      uuid: workflowUuid,
      ownerUserUuid: actorUuid,
    });

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

    await expect(
      service.updateWorkflow(workflowUuid, { name: 'Updated' }, actorUuid),
    ).resolves.toMatchObject({ name: 'Updated' });

    repo.getWorkflow.mockResolvedValueOnce({
      uuid: workflowUuid,
      ownerUserUuid: actorUuid,
      status: 'ACTIVE',
      versions: [],
    });
    await expect(
      service.updateWorkflow(workflowUuid, { name: 'Updated' }, actorUuid),
    ).rejects.toBeInstanceOf(ConflictException);

    const draft = await service.createDraftVersion(
      workflowUuid,
      definition,
      actorUuid,
    );
    expect(draft.version).toBe(1);

    const workflowWithVersions = {
      uuid: workflowUuid,
      ownerUserUuid: actorUuid,
      status: 'DRAFT',
      versions: [{ version: 2 }, { version: 5 }],
    };
    repo.getWorkflow
      .mockResolvedValueOnce(workflowWithVersions)
      .mockResolvedValueOnce(workflowWithVersions);
    const nextDraft = await service.createDraftVersion(
      workflowUuid,
      definition,
      actorUuid,
    );
    expect(nextDraft.version).toBe(6);

    await expect(
      service.publishActivate(workflowUuid, versionUuid, actorUuid),
    ).resolves.toMatchObject({ activeVersionUuid: versionUuid });
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
      listActiveVersions: vi.fn(() => Promise.resolve([version])),
      getWorkflow: vi.fn(() =>
        Promise.resolve({
          uuid: workflowUuid,
          ownerUserUuid: actorUuid,
          status: 'ACTIVE',
        }),
      ),
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

    await expect(
      service.dispatch({ ...event, action: 'deleted' }),
    ).resolves.toEqual([]);
  });

  it('covers cancellation, retry and scoped reads', async () => {
    const { service, repo, audit } = makeService();

    await expect(service.processDue('worker-1')).resolves.toBeNull();
    repo.getExecution.mockResolvedValueOnce({
      uuid: executionUuid,
      workflowUuid,
      workflowVersionUuid: versionUuid,
      state: 'FAILED',
      currentNodeId: 'action-1',
      contextSnapshot: {},
      actorUuid,
    });
    await expect(
      service.retryExecution(executionUuid, actorUuid),
    ).resolves.toMatchObject({ state: 'WAITING' });

    repo.getExecution.mockResolvedValueOnce({
      uuid: executionUuid,
      workflowUuid,
      workflowVersionUuid: versionUuid,
      state: 'WAITING',
      currentNodeId: 'action-1',
      contextSnapshot: {},
      actorUuid,
    });
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

    await expect(service.listWorkflows({}, actorUuid)).resolves.toMatchObject({
      items: [],
      total: 0,
    });
    await expect(service.listExecutions({}, actorUuid)).resolves.toMatchObject({
      items: [],
      total: 0,
    });
    await expect(
      service.listNotifications({
        userUuid: actorUuid,
        page: 1,
        limit: 10,
        unreadOnly: true,
      }),
    ).resolves.toMatchObject({ items: [], total: 0 });
    await expect(
      service.markNotificationRead('notification-1', actorUuid),
    ).resolves.toEqual({ success: true });
    expect(() =>
      service.listNotifications({
        userUuid: '',
        page: 1,
        limit: 10,
        unreadOnly: false,
      }),
    ).toThrow(BadRequestException);
  });

  it('covers assignment, SLA, escalation and dashboard rules', async () => {
    const { service, repo } = makeService();

    await expect(
      service.createAssignmentRule(
        workflowUuid,
        {
          name: 'Round robin',
          strategy: 'ROUND_ROBIN',
          criteria: { source: 'WEB' },
        },
        actorUuid,
      ),
    ).resolves.toMatchObject({ strategy: 'ROUND_ROBIN' });

    await expect(
      service.createAssignmentRule(
        workflowUuid,
        { strategy: 'INVALID' },
        actorUuid,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.createSlaPolicy(
        workflowUuid,
        {
          durationMinutes: 60,
          targetEntityType: 'LEAD',
          startEventType: 'created',
          stopEventTypes: ['qualified'],
        },
        actorUuid,
      ),
    ).resolves.toMatchObject({ durationMinutes: 60 });

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

    await expect(
      service.createEscalationPolicy(
        workflowUuid,
        { levels: [{ afterMinutes: 10 }] },
        actorUuid,
      ),
    ).resolves.toMatchObject({ maxAttempts: 3 });

    await expect(
      service.createEscalationPolicy(workflowUuid, { levels: [] }, actorUuid),
    ).rejects.toBeInstanceOf(BadRequestException);

    repo.listWorkflows.mockResolvedValueOnce({
      items: [],
      total: 7,
      page: 1,
      limit: 25,
    });
    repo.listExecutions.mockResolvedValueOnce({
      items: [
        { state: 'PENDING', attemptCount: 0 },
        { state: 'RUNNING', attemptCount: 1 },
        { state: 'SUCCEEDED', attemptCount: 2 },
        { state: 'FAILED', attemptCount: 0 },
      ],
      total: 4,
      page: 1,
      limit: 25,
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
      getExecution: vi.fn(() => Promise.resolve(baseExecution)),
      listActions: vi.fn(() => Promise.resolve([])),
      claimDueExecution: vi.fn(() => Promise.resolve(baseExecution)),
    });
    await expect(success.service.processDue('worker-1')).resolves.toMatchObject(
      {
        state: 'SUCCEEDED',
      },
    );

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
    await expect(retry.service.processDue('worker-1')).resolves.toMatchObject({
      state: 'WAITING',
    });

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
    await expect(fail.service.processDue('worker-1')).resolves.toMatchObject({
      state: 'FAILED',
    });

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
    await expect(
      unsupported.service.processDue('worker-1'),
    ).resolves.toMatchObject({ state: 'FAILED' });
  });

  it('rejects missing resources and inactive capability targets', async () => {
    const missing = makeService({
      getWorkflow: vi.fn(() => Promise.resolve(null)),
      getExecution: vi.fn(() => Promise.resolve(null)),
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
      status: 'DISABLED',
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
