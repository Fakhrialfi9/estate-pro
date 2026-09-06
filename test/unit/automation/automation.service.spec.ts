import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import { AutomationService } from '../../../src/modules/automation/application/services/automation.service.js';
import type { AutomationCrmPort } from '../../../src/common/contracts/automation-crm.port.js';
import type { AutomationSalesPort } from '../../../src/common/contracts/automation-sales.port.js';
import type { UserPublicPort } from '../../../src/common/contracts/user-public.port.js';
import type {
  ActionHandler,
  AutomationEvent,
  AutomationRepository,
} from '../../../src/modules/automation/domain/automation.ports.js';
import { WorkflowValidator } from '../../../src/modules/automation/application/validation/workflow-validator.js';

const actorUuid = '11111111-1111-4111-8111-111111111111';
const workflowUuid = '22222222-2222-4222-8222-222222222222';
const versionUuid = '33333333-3333-4333-8333-333333333333';
const executionUuid = '44444444-4444-4444-8444-444444444444';

const definition = {
  trigger: { type: 'ENTITY_CREATED', entityType: 'LEAD' },
  graph: {
    entryNodeId: 'trigger',
    nodes: [
      {
        id: 'trigger',
        type: 'TRIGGER',
        trigger: { type: 'ENTITY_CREATED', entityType: 'LEAD' },
      },
    ],
    edges: [],
  },
};

const actionDefinition = {
  trigger: { type: 'ENTITY_CREATED', entityType: 'LEAD' },
  graph: {
    entryNodeId: 'trigger',
    nodes: [
      {
        id: 'trigger',
        type: 'TRIGGER',
        trigger: { type: 'ENTITY_CREATED', entityType: 'LEAD' },
      },
      {
        id: 'notify',
        type: 'ACTION',
        actionType: 'NOTIFY',
        input: { userUuid: actorUuid },
        maxAttempts: 2,
      },
    ],
    edges: [{ from: 'trigger', to: 'notify' }],
  },
};

const event: AutomationEvent = {
  eventId: 'event-1',
  occurredAt: new Date('2026-09-01T00:00:00.000Z'),
  actorUuid,
  entityType: 'LEAD',
  entityUuid: '55555555-5555-4555-8555-555555555555',
  action: 'created',
  version: 1,
  payload: { password: 'redact-me' },
};

describe('AutomationService', () => {
  const repo: Mocked<AutomationRepository> = {
    createWorkflow: vi.fn(),
    updateWorkflow: vi.fn(),
    getWorkflow: vi.fn(),
    listWorkflows: vi.fn(),
    createVersion: vi.fn(),
    getVersion: vi.fn(),
    listActiveVersions: vi.fn(),
    updateVersion: vi.fn(),
    createExecution: vi.fn(),
    getExecution: vi.fn(),
    listExecutions: vi.fn(),
    updateExecution: vi.fn(),
    createAction: vi.fn(),
    listActions: vi.fn(),
    updateAction: vi.fn(),
    claimDueExecution: vi.fn(),
    createAssignmentRule: vi.fn(),
    createSlaPolicy: vi.fn(),
    createEscalationPolicy: vi.fn(),
    listNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
  } as Mocked<AutomationRepository>;
  const crm: Mocked<AutomationCrmPort> = {
    getLead: vi.fn(),
    getActivity: vi.fn(),
  } as Mocked<AutomationCrmPort>;
  const sales: Mocked<AutomationSalesPort> = {
    getOpportunity: vi.fn(),
    listOpenOpportunities: vi.fn(),
  };
  const users: Mocked<UserPublicPort> = {
    getUser: vi.fn(),
  };
  const auditRecord = vi.fn().mockResolvedValue(undefined);
  const handler: Mocked<ActionHandler> = {
    actionType: 'NOTIFY',
    execute: vi.fn(),
  };
  const service = new AutomationService(
    repo,
    crm,
    sales,
    users,
    { record: auditRecord },
    new WorkflowValidator(),
    [handler],
  );

  beforeEach(() => {
    vi.clearAllMocks();
    users.getUser.mockResolvedValue({
      uuid: actorUuid,
      status: 'ACTIVE',
      isActive: true,
      deletedAt: null,
    });
    repo.createWorkflow.mockResolvedValue({
      uuid: workflowUuid,
      ownerUserUuid: actorUuid,
      status: 'DRAFT',
    });
    repo.getWorkflow.mockResolvedValue({
      uuid: workflowUuid,
      ownerUserUuid: actorUuid,
      status: 'DRAFT',
      versions: [],
    });
    repo.updateWorkflow.mockResolvedValue({
      uuid: workflowUuid,
      ownerUserUuid: actorUuid,
      status: 'ACTIVE',
    });
    repo.listWorkflows.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 100,
    });
    repo.listExecutions.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 100,
    });
    repo.getVersion.mockResolvedValue({
      uuid: versionUuid,
      workflowUuid,
      version: 1,
      status: 'DRAFT',
      definition,
    });
    repo.updateVersion.mockResolvedValue({
      uuid: versionUuid,
      status: 'ACTIVE',
    });
    repo.listActiveVersions.mockResolvedValue([
      {
        uuid: versionUuid,
        workflowUuid,
        triggerDefinition: definition.trigger,
        definition,
      },
    ]);
    repo.createExecution.mockResolvedValue({ uuid: executionUuid });
    repo.getExecution.mockResolvedValue({
      uuid: executionUuid,
      workflowUuid,
      workflowVersionUuid: versionUuid,
      state: 'PENDING',
    });
    repo.updateExecution.mockResolvedValue({
      uuid: executionUuid,
      state: 'WAITING',
    });
    repo.listActions.mockResolvedValue([]);
    repo.createAction.mockResolvedValue({
      uuid: '66666666-6666-4666-8666-666666666666',
      nodeId: 'notify',
      state: 'PENDING',
      attempt: 0,
      maxAttempts: 2,
    });
    repo.updateAction.mockResolvedValue({ uuid: 'action-1' });
    crm.getLead.mockResolvedValue({
      uuid: event.entityUuid,
      contactUuid: null,
      status: 'NEW',
      source: 'WEB',
      type: 'BUYER',
      ownerUserUuid: actorUuid,
      score: 10,
      createdAt: event.occurredAt,
      updatedAt: event.occurredAt,
    });
  });

  it('creates an owned workflow and records its audit event', async () => {
    await expect(
      service.createWorkflow(
        {
          name: '  Lead routing  ',
          description: '  Route leads  ',
          ownerUserUuid: actorUuid,
        },
        actorUuid,
      ),
    ).resolves.toEqual({
      uuid: workflowUuid,
      ownerUserUuid: actorUuid,
      status: 'DRAFT',
    });

    expect(repo.createWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Lead routing',
        description: 'Route leads',
        ownerUserUuid: actorUuid,
        createdBy: actorUuid,
      }),
    );
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AUTOMATION_WORKFLOW_CREATED',
        entityUuid: workflowUuid,
        actorUuid,
      }),
    );
  });

  it('rejects invalid workflow names and owners before persistence', async () => {
    await expect(
      service.createWorkflow(
        { name: ' ', ownerUserUuid: actorUuid },
        actorUuid,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.createWorkflow).not.toHaveBeenCalled();

    users.getUser.mockResolvedValueOnce({
      uuid: actorUuid,
      status: 'DISABLED',
      isActive: false,
      deletedAt: null,
    });
    await expect(
      service.createWorkflow(
        { name: 'Inactive', ownerUserUuid: actorUuid },
        actorUuid,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    users.getUser.mockResolvedValueOnce({
      uuid: workflowUuid,
      status: 'ACTIVE',
      isActive: true,
      deletedAt: null,
    });

    await expect(
      service.createWorkflow(
        { name: 'Other', ownerUserUuid: workflowUuid },
        actorUuid,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('scopes workflow and execution pagination to the authenticated owner', async () => {
    await service.listWorkflows(
      { page: 2, limit: 25, status: 'ACTIVE' },
      actorUuid,
    );
    await service.listExecutions({ page: 3, limit: 10 }, actorUuid);

    expect(repo.listWorkflows).toHaveBeenCalledWith({
      page: 2,
      limit: 25,
      status: 'ACTIVE',
      ownerUserUuid: actorUuid,
    });
    expect(repo.listExecutions).toHaveBeenCalledWith({
      page: 3,
      limit: 10,
      ownerUserUuid: actorUuid,
    });
  });

  it('rejects updates for missing, foreign, or non-draft workflows', async () => {
    repo.getWorkflow.mockResolvedValueOnce(null);
    await expect(
      service.updateWorkflow(workflowUuid, { name: 'Updated' }, actorUuid),
    ).rejects.toBeInstanceOf(NotFoundException);

    repo.getWorkflow.mockResolvedValueOnce({
      uuid: workflowUuid,
      ownerUserUuid: '77777777-7777-4777-8777-777777777777',
      status: 'DRAFT',
    });
    await expect(
      service.updateWorkflow(workflowUuid, { name: 'Updated' }, actorUuid),
    ).rejects.toBeInstanceOf(ForbiddenException);

    repo.getWorkflow.mockResolvedValue({
      uuid: workflowUuid,
      ownerUserUuid: actorUuid,
      status: 'ACTIVE',
    });
    await expect(
      service.updateWorkflow(workflowUuid, { name: 'Updated' }, actorUuid),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.updateWorkflow).not.toHaveBeenCalled();
  });

  it('publishes a draft version, pauses the previous active version, and audits activation', async () => {
    repo.getWorkflow
      .mockResolvedValueOnce({
        uuid: workflowUuid,
        ownerUserUuid: actorUuid,
        status: 'DRAFT',
        activeVersionUuid: '88888888-8888-4888-8888-888888888888',
      })
      .mockResolvedValueOnce({
        uuid: workflowUuid,
        ownerUserUuid: actorUuid,
        status: 'DRAFT',
      });
    repo.getVersion
      .mockResolvedValueOnce({
        uuid: versionUuid,
        workflowUuid,
        version: 2,
        status: 'DRAFT',
        definition,
      })
      .mockResolvedValueOnce({
        uuid: '88888888-8888-4888-8888-888888888888',
        status: 'ACTIVE',
      });

    await service.publishActivate(workflowUuid, versionUuid, actorUuid);

    expect(repo.updateVersion).toHaveBeenNthCalledWith(1, versionUuid, {
      status: 'ACTIVE',
      activatedAt: expect.any(Date),
    });
    expect(repo.updateVersion).toHaveBeenNthCalledWith(
      2,
      '88888888-8888-4888-8888-888888888888',
      {
        status: 'PAUSED',
      },
    );
    expect(repo.updateWorkflow).toHaveBeenCalledWith(workflowUuid, {
      status: 'ACTIVE',
      activeVersionUuid: versionUuid,
      updatedBy: actorUuid,
    });
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AUTOMATION_WORKFLOW_ACTIVATED',
        reason: 'version=2',
      }),
    );
  });

  it('dispatches matching lead events into executions and audits creation', async () => {
    repo.getWorkflow.mockResolvedValueOnce({
      uuid: workflowUuid,
      ownerUserUuid: actorUuid,
      status: 'ACTIVE',
    });

    await expect(
      service.dispatch({ ...event, action: undefined }),
    ).resolves.toEqual([{ uuid: executionUuid }]);
    expect(repo.createExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowUuid,
        workflowVersionUuid: versionUuid,
        eventId: event.eventId,
        currentNodeId: 'trigger',
        state: 'PENDING',
        contextSnapshot: expect.objectContaining({
          entityType: 'LEAD',
          chainDepth: 1,
        }),
      }),
    );
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AUTOMATION_EXECUTION_CREATED' }),
    );
  });

  it('ignores non-matching triggers and protects notification authentication inputs', async () => {
    repo.listActiveVersions.mockResolvedValueOnce([
      {
        uuid: versionUuid,
        workflowUuid,
        triggerDefinition: {
          type: 'ENTITY_UPDATED',
          entityType: 'LEAD',
        },
        definition,
      },
    ]);
    await expect(service.dispatch(event)).resolves.toEqual([]);
    expect(repo.createExecution).not.toHaveBeenCalled();

    expect(() =>
      service.listNotifications({
        userUuid: '',
        page: 1,
        limit: 20,
        unreadOnly: true,
      }),
    ).toThrow(BadRequestException);
    expect(() => service.markNotificationRead('notification-1', '')).toThrow(
      BadRequestException,
    );
  });

  it('retries failed executions and rejects non-retryable execution states', async () => {
    repo.getExecution.mockResolvedValueOnce({
      uuid: executionUuid,
      state: 'FAILED',
    });
    repo.listActions.mockResolvedValueOnce([
      { uuid: 'action-1', state: 'FAILED' },
      { uuid: 'action-2', state: 'SUCCEEDED' },
    ]);
    await service.retryExecution(executionUuid, actorUuid);

    expect(repo.updateAction).toHaveBeenCalledWith(
      'action-1',
      expect.objectContaining({ state: 'RETRYABLE', errorCode: null }),
    );
    expect(repo.updateAction).toHaveBeenCalledTimes(1);
    expect(repo.updateExecution).toHaveBeenCalledWith(
      executionUuid,
      expect.objectContaining({ state: 'WAITING', claimedBy: null }),
    );
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AUTOMATION_EXECUTION_RETRIED' }),
    );

    repo.getExecution.mockResolvedValueOnce({
      uuid: executionUuid,
      state: 'SUCCEEDED',
    });
    await expect(
      service.retryExecution(executionUuid, actorUuid),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cancels a pending execution and rejects cancellation of a completed one', async () => {
    repo.getExecution.mockResolvedValueOnce({
      uuid: executionUuid,
      state: 'PENDING',
    });
    await service.cancelExecution(executionUuid, actorUuid);
    expect(repo.updateExecution).toHaveBeenCalledWith(
      executionUuid,
      expect.objectContaining({ state: 'CANCELLED', claimedBy: null }),
    );
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AUTOMATION_EXECUTION_CANCELLED' }),
    );

    repo.getExecution.mockResolvedValueOnce({
      uuid: executionUuid,
      state: 'SUCCEEDED',
    });
    await expect(
      service.cancelExecution(executionUuid, actorUuid),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('moves a retryable action exception to waiting state', async () => {
    repo.claimDueExecution.mockResolvedValueOnce({
      uuid: executionUuid,
      workflowUuid,
      workflowVersionUuid: versionUuid,
      currentNodeId: 'trigger',
      contextSnapshot: {},
      state: 'RUNNING',
      actorUuid,
    });
    repo.getVersion.mockResolvedValueOnce({
      uuid: versionUuid,
      workflowUuid,
      definition: actionDefinition,
    });
    handler.execute = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary outage'));

    await service.processDue('worker-1');

    expect(repo.updateAction).toHaveBeenCalledWith(
      '66666666-6666-4666-8666-666666666666',
      expect.objectContaining({
        state: 'RETRYABLE',
        errorCode: 'ACTION_EXCEPTION',
      }),
    );
    expect(repo.updateExecution).toHaveBeenCalledWith(
      executionUuid,
      expect.objectContaining({
        state: 'WAITING',
        lastErrorCode: 'ACTION_EXCEPTION',
      }),
    );
  });
});
