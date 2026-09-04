import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ACTION_TYPES,
  TRIGGER_TYPES,
  decideRetry,
  parseDefinition,
  type ActionNode,
  type ConditionNode,
  type WorkflowDefinition,
} from '../../domain/automation.types.js';
import type {
  AutomationEvent,
  AutomationRepository,
  ActionHandler,
} from '../../domain/automation.ports.js';
import {
  CRM_AUTOMATION_PORT,
  type AutomationCrmPort,
} from '../../../../common/contracts/automation-crm.port.js';
import {
  SALES_AUTOMATION_PORT,
  type AutomationSalesPort,
} from '../../../../common/contracts/automation-sales.port.js';
import {
  USER_PUBLIC_PORT,
  type UserPublicPort,
} from '../../../../common/contracts/user-public.port.js';
import {
  SECURITY_AUDIT_REPOSITORY,
  type SecurityAuditRepository,
} from '../../../../common/audit/security-audit.port.js';
import { AUTOMATION_REPOSITORY } from '../../infrastructure/persistence/automation.repository.token.js';
import { WorkflowValidator } from '../validation/workflow-validator.js';

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const unknownArray = (value: unknown): readonly unknown[] =>
  Array.isArray(value) ? value : [];

const recordArray = (value: unknown): readonly Record<string, unknown>[] =>
  unknownArray(value).filter(
    (item): item is Record<string, unknown> =>
      item !== null && typeof item === 'object' && !Array.isArray(item),
  );

const stringArray = (value: unknown): readonly string[] =>
  unknownArray(value).filter(
    (item): item is string => typeof item === 'string',
  );

const toStringValue = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  )
    return String(value);
  if (value instanceof Date) return value.toISOString();
  return fallback;
};

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const toDateValue = (value: unknown, field: string): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (!Number.isNaN(value.getTime())) return value;
    throw new BadRequestException(`Invalid ${field}`);
  }
  if (typeof value !== 'string')
    throw new BadRequestException(`Invalid ${field}`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new BadRequestException(`Invalid ${field}`);
  return date;
};

const safeJson = (value: unknown): Record<string, unknown> => {
  const replacer = (key: string, entry: unknown): unknown =>
    /token|secret|password|credential/i.test(key) ? '[REDACTED]' : entry;
  const text = JSON.stringify(value, replacer);
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return record(parsed);
  } catch {
    return {};
  }
};

const isTriggerType = (
  value: unknown,
): value is (typeof TRIGGER_TYPES)[number] =>
  typeof value === 'string' &&
  TRIGGER_TYPES.includes(value as (typeof TRIGGER_TYPES)[number]);

@Injectable()
export class AutomationService {
  constructor(
    @Inject(AUTOMATION_REPOSITORY) private readonly repo: AutomationRepository,
    @Inject(CRM_AUTOMATION_PORT) private readonly crm: AutomationCrmPort,
    @Inject(SALES_AUTOMATION_PORT) private readonly sales: AutomationSalesPort,
    @Inject(USER_PUBLIC_PORT) private readonly users: UserPublicPort,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
    private readonly validator: WorkflowValidator,
    private readonly handlers: readonly ActionHandler[],
  ) {}

  async createWorkflow(
    input: { name: string; description?: string; ownerUserUuid: string },
    actorUuid: string,
  ): Promise<Record<string, unknown>> {
    if (!input.name?.trim())
      throw new BadRequestException('Workflow name is required');
    const owner = await this.users.getUser(input.ownerUserUuid);
    if (!owner.isActive || owner.deletedAt)
      throw new ForbiddenException('Workflow owner is not active');
    if (owner.uuid !== actorUuid)
      throw new ForbiddenException('Workflow owner is outside your scope');
    const workflow = await this.repo.createWorkflow({
      uuid: randomUUID(),
      name: input.name.trim().slice(0, 180),
      description: input.description?.trim() ?? null,
      ownerUserUuid: owner.uuid,
      createdBy: actorUuid,
      updatedBy: actorUuid,
    });
    await this.auditRecord(
      'AUTOMATION_WORKFLOW_CREATED',
      'automation_workflow',
      toStringValue(workflow.uuid),
      actorUuid,
    );
    return workflow;
  }

  async updateWorkflow(
    uuid: string,
    input: { name?: string; description?: string },
    actorUuid: string,
  ): Promise<Record<string, unknown>> {
    const workflow = await this.requireOwnedWorkflow(uuid, actorUuid);
    if (workflow.status !== 'DRAFT')
      throw new ConflictException('Only draft workflows can be edited');
    const patch: Record<string, unknown> = { updatedBy: actorUuid };
    if (input.name !== undefined) {
      if (!input.name.trim())
        throw new BadRequestException('Workflow name is required');
      patch.name = input.name.trim().slice(0, 180);
    }
    if (input.description !== undefined)
      patch.description = input.description.trim();
    return this.repo.updateWorkflow(uuid, patch);
  }

  async createDraftVersion(
    workflowUuid: string,
    definition: unknown,
    actorUuid: string,
  ): Promise<Record<string, unknown>> {
    await this.requireOwnedWorkflow(workflowUuid, actorUuid);
    const parsed = parseDefinition(definition);
    const checksum = this.validator.checksum(parsed);
    const workflow = await this.repo.getWorkflow(workflowUuid);
    if (!workflow) throw new NotFoundException('Workflow not found');
    let version = 0;
    for (const item of unknownArray(workflow.versions)) {
      version = Math.max(version, toFiniteNumber(record(item).version));
    }
    version += 1;
    return this.repo.createVersion({
      uuid: randomUUID(),
      workflowUuid,
      version,
      status: 'DRAFT',
      triggerDefinition: parsed.trigger,
      definition: parsed,
      checksum,
      createdBy: actorUuid,
      activatedAt: null,
    });
  }

  async publishActivate(
    workflowUuid: string,
    versionUuid: string,
    actorUuid: string,
  ) {
    const workflow = await this.requireOwnedWorkflow(workflowUuid, actorUuid);
    const version = await this.repo.getVersion(versionUuid);
    if (!version || toStringValue(version.workflowUuid) !== workflowUuid)
      throw new NotFoundException('Workflow version not found');
    if (version.status !== 'DRAFT')
      throw new BadRequestException('Only draft versions can be activated');
    const definition = parseDefinition(version.definition);
    this.validator.validate(definition);
    await this.assertCapabilities(definition);
    await this.repo.updateVersion(versionUuid, {
      status: 'ACTIVE',
      activatedAt: new Date(),
    });
    if (
      workflow.activeVersionUuid &&
      toStringValue(workflow.activeVersionUuid) !== versionUuid
    ) {
      const previousVersionUuid = toStringValue(workflow.activeVersionUuid);
      const previous = await this.repo.getVersion(previousVersionUuid);
      if (previous?.status === 'ACTIVE')
        await this.repo.updateVersion(previousVersionUuid, {
          status: 'PAUSED',
        });
    }
    const result = await this.repo.updateWorkflow(workflowUuid, {
      status: 'ACTIVE',
      activeVersionUuid: versionUuid,
      updatedBy: actorUuid,
    });
    await this.auditRecord(
      'AUTOMATION_WORKFLOW_ACTIVATED',
      'automation_workflow',
      workflowUuid,
      actorUuid,
      `version=${toStringValue(version.version)}`,
    );
    return result;
  }

  async pauseWorkflow(uuid: string, actorUuid: string) {
    await this.requireOwnedWorkflow(uuid, actorUuid);
    const result = await this.repo.updateWorkflow(uuid, {
      status: 'PAUSED',
      updatedBy: actorUuid,
    });
    await this.auditRecord(
      'AUTOMATION_WORKFLOW_PAUSED',
      'automation_workflow',
      uuid,
      actorUuid,
    );
    return result;
  }

  async archiveWorkflow(uuid: string, actorUuid: string) {
    await this.requireOwnedWorkflow(uuid, actorUuid);
    const result = await this.repo.updateWorkflow(uuid, {
      status: 'ARCHIVED',
      updatedBy: actorUuid,
    });
    await this.auditRecord(
      'AUTOMATION_WORKFLOW_ARCHIVED',
      'automation_workflow',
      uuid,
      actorUuid,
    );
    return result;
  }

  async dispatch(event: AutomationEvent) {
    const active = await this.repo.listActiveVersions();
    const created: Record<string, unknown>[] = [];
    for (const version of active) {
      const trigger = record(version.triggerDefinition);
      if (!this.triggerMatches(trigger, event)) continue;
      const workflow = await this.repo.getWorkflow(
        toStringValue(version.workflowUuid),
      );
      if (!workflow || workflow.status !== 'ACTIVE') continue;
      const context = await this.resolveContext(event);
      const depth = toFiniteNumber(context.chainDepth);
      if (depth >= 20) continue;
      const graphRecord = record(record(version.definition).graph);
      const execution = await this.repo.createExecution({
        uuid: randomUUID(),
        workflowUuid: version.workflowUuid,
        workflowVersionUuid: version.uuid,
        eventId: event.eventId,
        eventType: event.action ?? event.entityType,
        entityType: event.entityType,
        entityUuid: event.entityUuid,
        state: 'PENDING',
        currentNodeId: toStringValue(graphRecord.entryNodeId),
        contextSnapshot: safeJson({
          ...context,
          entityType: event.entityType,
          event: safeJson(event.payload),
          chainDepth: depth + 1,
        }),
        visitedWorkflowUuids: [version.workflowUuid],
        attemptCount: 0,
        maxAttempts: 3,
      });
      created.push(execution);
      await this.auditRecord(
        'AUTOMATION_EXECUTION_CREATED',
        'automation_execution',
        toStringValue(execution.uuid),
        event.actorUuid ?? undefined,
        `workflow=${toStringValue(version.workflowUuid)}`,
      );
    }
    return created;
  }

  async processDue(workerId: string, leaseMs = 30_000) {
    const execution = await this.repo.claimDueExecution(workerId, leaseMs);
    return execution ? this.executeWorkflow(execution, workerId) : null;
  }

  async retryExecution(uuid: string, actorUuid: string) {
    const execution = await this.requireExecution(uuid);
    if (!['FAILED', 'DEAD_LETTER'].includes(toStringValue(execution.state)))
      throw new BadRequestException('Execution is not retryable');
    for (const action of (await this.repo.listActions(uuid)).filter((value) =>
      ['FAILED', 'RETRYABLE'].includes(toStringValue(record(value).state)),
    ))
      await this.repo.updateAction(toStringValue(record(action).uuid), {
        state: 'RETRYABLE',
        availableAt: new Date(),
        errorCode: null,
        errorMessage: null,
      });
    const updated = await this.repo.updateExecution(uuid, {
      state: 'WAITING',
      retryAt: new Date(),
      lastErrorCode: null,
      lastErrorMessage: null,
      claimedBy: null,
      leaseUntil: null,
    });
    await this.auditRecord(
      'AUTOMATION_EXECUTION_RETRIED',
      'automation_execution',
      uuid,
      actorUuid,
    );
    return updated;
  }

  async cancelExecution(uuid: string, actorUuid: string) {
    const execution = await this.requireExecution(uuid);
    if (
      !['PENDING', 'RUNNING', 'WAITING'].includes(
        toStringValue(execution.state),
      )
    )
      throw new BadRequestException('Execution is not cancellable');
    const updated = await this.repo.updateExecution(uuid, {
      state: 'CANCELLED',
      completedAt: new Date(),
      claimedBy: null,
      leaseUntil: null,
    });
    await this.auditRecord(
      'AUTOMATION_EXECUTION_CANCELLED',
      'automation_execution',
      uuid,
      actorUuid,
    );
    return updated;
  }

  listWorkflows(query: unknown, actorUuid: string) {
    return this.repo.listWorkflows({
      ...record(query),
      ownerUserUuid: actorUuid,
    });
  }

  getWorkflow(uuid: string, actorUuid: string) {
    return this.requireOwnedWorkflow(uuid, actorUuid);
  }

  listExecutions(query: unknown, actorUuid: string) {
    return this.repo.listExecutions({
      ...record(query),
      ownerUserUuid: actorUuid,
    });
  }

  async getExecution(uuid: string, actorUuid: string) {
    const execution = await this.requireExecution(uuid);
    const workflow = await this.repo.getWorkflow(
      toStringValue(execution.workflowUuid),
    );
    if (!workflow || toStringValue(workflow.ownerUserUuid) !== actorUuid)
      throw new ForbiddenException();
    return execution;
  }

  listNotifications(input: {
    userUuid: string;
    page: number;
    limit: number;
    unreadOnly: boolean;
  }) {
    if (!input.userUuid)
      throw new BadRequestException('Authenticated actor missing');
    return this.repo.listNotifications(input);
  }

  markNotificationRead(uuid: string, userUuid: string) {
    if (!userUuid) throw new BadRequestException('Authenticated actor missing');
    return this.repo.markNotificationRead(uuid, userUuid);
  }

  async createAssignmentRule(
    workflowUuid: string,
    input: unknown,
    actorUuid: string,
  ) {
    await this.requireOwnedWorkflow(workflowUuid, actorUuid);
    const data = record(input);
    const strategy = toStringValue(data.strategy, 'FIXED_USER');
    if (
      !['ROUND_ROBIN', 'FIXED_USER', 'FIXED_TEAM', 'LEAST_LOAD'].includes(
        strategy,
      )
    )
      throw new BadRequestException('Unsupported assignment strategy');
    return this.repo.createAssignmentRule({
      uuid: randomUUID(),
      workflowUuid,
      name: toStringValue(data.name, 'Assignment rule').slice(0, 180),
      criteria: record(data.criteria),
      strategy,
      fallback: data.fallback === undefined ? null : record(data.fallback),
      activeFrom: toDateValue(data.activeFrom, 'activeFrom'),
      activeUntil: toDateValue(data.activeUntil, 'activeUntil'),
      isActive: data.isActive !== false,
    });
  }

  async createSlaPolicy(
    workflowUuid: string,
    input: unknown,
    actorUuid: string,
  ) {
    await this.requireOwnedWorkflow(workflowUuid, actorUuid);
    const data = record(input);
    const duration = toFiniteNumber(data.durationMinutes, Number.NaN);
    if (!Number.isInteger(duration) || duration <= 0 || duration > 525600)
      throw new BadRequestException('Invalid SLA duration');
    const targetEntityType = toStringValue(data.targetEntityType);
    const startEventType = toStringValue(data.startEventType);
    if (!targetEntityType || !startEventType)
      throw new BadRequestException('SLA target and start event are required');
    return this.repo.createSlaPolicy({
      uuid: randomUUID(),
      workflowUuid,
      name: toStringValue(data.name, 'SLA').slice(0, 180),
      targetEntityType,
      startEventType,
      stopEventTypes: stringArray(data.stopEventTypes),
      durationMinutes: duration,
      timezone: toStringValue(data.timezone, 'UTC'),
      businessHours: record(data.businessHours ?? { enabled: false }),
      isActive: data.isActive !== false,
      version: 1,
    });
  }

  async createEscalationPolicy(
    workflowUuid: string,
    input: unknown,
    actorUuid: string,
  ) {
    await this.requireOwnedWorkflow(workflowUuid, actorUuid);
    const data = record(input);
    const levels = recordArray(data.levels);
    if (levels.length === 0 || levels.length > 10)
      throw new BadRequestException('Escalation requires 1-10 levels');
    const maxAttempts = Math.min(
      10,
      Math.max(1, toFiniteNumber(data.maxAttempts, 3)),
    );
    const cooldownSeconds = Math.max(
      1,
      toFiniteNumber(data.cooldownSeconds, 3600),
    );
    return this.repo.createEscalationPolicy({
      uuid: randomUUID(),
      workflowUuid,
      name: toStringValue(data.name, 'Escalation').slice(0, 180),
      levels,
      maxAttempts,
      cooldownSeconds,
      isActive: data.isActive !== false,
    });
  }

  async dashboard(actorUuid: string) {
    const [workflows, executions] = await Promise.all([
      this.repo.listWorkflows({
        ownerUserUuid: actorUuid,
        page: 1,
        limit: 100,
      }),
      this.repo.listExecutions({
        ownerUserUuid: actorUuid,
        page: 1,
        limit: 100,
      }),
    ]);
    const list = executions.items;
    const count = (state: string) =>
      list.filter((item) => toStringValue(record(item).state) === state).length;
    return {
      data: {
        workflowCount: workflows.total,
        executionCount: executions.total,
        pending: count('PENDING'),
        running: count('RUNNING'),
        succeeded: count('SUCCEEDED'),
        failed: count('FAILED'),
        retried: list.filter(
          (item) => toFiniteNumber(record(item).attemptCount) > 0,
        ).length,
      },
    };
  }

  private triggerMatches(
    trigger: Record<string, unknown>,
    event: AutomationEvent,
  ): boolean {
    if (
      !isTriggerType(trigger.type) ||
      toStringValue(trigger.entityType) !== event.entityType
    )
      return false;
    const type = trigger.type;
    const action = toStringValue(event.action);
    const mappings: Record<string, string[]> = {
      ENTITY_CREATED: ['created', 'CREATE'],
      ENTITY_UPDATED: ['updated', 'UPDATE'],
      STATUS_CHANGED: ['status_changed', 'STATUS_CHANGED'],
      ASSIGNED: ['assigned', 'ASSIGNED'],
      SCORE_CHANGED: ['score_changed', 'SCORE_CHANGED'],
      DUE: ['due', 'DUE'],
      SCHEDULED: ['scheduled', 'SCHEDULED'],
      SLA_BREACHED: ['sla_breached', 'SLA_BREACHED'],
      INBOUND_INTENT: ['inbound_intent', 'INBOUND_INTENT'],
    };
    return action === '' || (mappings[type] ?? []).includes(action);
  }

  private async resolveContext(
    event: AutomationEvent,
  ): Promise<Record<string, unknown>> {
    if (event.entityType === 'LEAD') {
      const lead = await this.crm.getLead(event.entityUuid);
      return {
        uuid: lead.uuid,
        contactUuid: lead.contactUuid,
        status: lead.status,
        source: lead.source,
        type: lead.type,
        ownerUserUuid: lead.ownerUserUuid,
        score: lead.score,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
      };
    }
    if (event.entityType === 'ACTIVITY')
      return {
        uuid: event.entityUuid,
        entityType: event.entityType,
        activity: await this.crm.getActivity(event.entityUuid),
      };
    if (event.entityType === 'OPPORTUNITY' || event.entityType === 'DEAL') {
      const opportunity = await this.sales.getOpportunity(event.entityUuid);
      return {
        uuid: opportunity.uuid,
        entityType: event.entityType,
        leadUuid: opportunity.leadUuid,
        contactUuid: opportunity.contactUuid,
        ownerUserUuid: opportunity.ownerUserUuid,
        teamUuid: opportunity.teamUuid,
        pipelineUuid: opportunity.pipelineUuid,
        stageUuid: opportunity.stageUuid,
        status: opportunity.status,
        title: opportunity.title,
        valueAmount: opportunity.valueAmount,
        currency: opportunity.currency,
        version: opportunity.version,
      };
    }
    return { uuid: event.entityUuid, entityType: event.entityType };
  }

  private async executeWorkflow(
    execution: Record<string, unknown>,
    workerId: string,
  ) {
    const version = await this.repo.getVersion(
      toStringValue(execution.workflowVersionUuid),
    );
    if (!version)
      return this.failExecution(
        toStringValue(execution.uuid),
        'VERSION_NOT_FOUND',
        'Workflow version not found',
      );
    const definition = parseDefinition(version.definition);
    const context = record(execution.contextSnapshot);
    const graph = definition.graph;
    const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
    let current: string | null = toStringValue(
      execution.currentNodeId,
      graph.entryNodeId,
    );
    const visited = new Set<string>();
    while (current) {
      const latest = await this.repo.getExecution(
        toStringValue(execution.uuid),
      );
      if (toStringValue(record(latest).state) === 'CANCELLED') return latest;
      if (visited.has(current))
        return this.failExecution(
          toStringValue(execution.uuid),
          'WORKFLOW_LOOP',
          'Workflow execution loop detected',
        );
      visited.add(current);
      const node = nodes.get(current);
      if (!node)
        return this.failExecution(
          toStringValue(execution.uuid),
          'NODE_NOT_FOUND',
          `Workflow node ${current} not found`,
        );
      if (node.type === 'CONDITION') {
        const pass = this.evaluateCondition(node, context);
        current = this.nextNode(graph.edges, current, pass);
      } else if (node.type === 'ACTION') {
        const result = await this.runAction(execution, node, context, workerId);
        if (!result.success) return result.execution;
        current = this.nextNode(graph.edges, current, true);
      } else current = this.nextNode(graph.edges, current, true);
      if (!current)
        return this.repo.updateExecution(toStringValue(execution.uuid), {
          state: 'SUCCEEDED',
          completedAt: new Date(),
          leaseUntil: null,
          claimedBy: null,
          currentNodeId: null,
        });
      await this.repo.updateExecution(toStringValue(execution.uuid), {
        currentNodeId: current,
      });
    }
    return execution;
  }

  private async runAction(
    execution: Record<string, unknown>,
    node: ActionNode,
    context: Record<string, unknown>,
    workerId: string,
  ) {
    const latest = await this.repo.getExecution(toStringValue(execution.uuid));
    if (toStringValue(record(latest).state) === 'CANCELLED')
      return { success: false, execution: latest };
    const existing = (
      await this.repo.listActions(toStringValue(execution.uuid))
    ).find((value) => toStringValue(record(value).nodeId) === node.id);
    const action =
      existing ??
      (await this.repo.createAction({
        uuid: randomUUID(),
        executionUuid: execution.uuid,
        nodeId: node.id,
        actionType: node.actionType,
        state: 'PENDING',
        input: node.input,
        attempt: 0,
        maxAttempts: node.maxAttempts ?? 3,
      }));
    if (toStringValue(record(action).state) === 'SUCCEEDED')
      return { success: true, execution };
    const handler = this.handlers.find(
      (item) => item.actionType === node.actionType,
    );
    if (!handler)
      return {
        success: false,
        execution: await this.failExecution(
          toStringValue(execution.uuid),
          'ACTION_UNAVAILABLE',
          `Unsupported action ${node.actionType}`,
        ),
      };
    const attempt = toFiniteNumber(record(action).attempt) + 1;
    await this.repo.updateAction(toStringValue(record(action).uuid), {
      state: 'RUNNING',
      attempt,
      claimedBy: workerId,
      leaseUntil: new Date(Date.now() + (node.timeoutMs ?? 30_000)),
    });
    try {
      const result = await handler.execute(
        node.input,
        context,
        typeof execution.actorUuid === 'string'
          ? execution.actorUuid
          : 'SYSTEM',
      );
      if (result.success) {
        await this.repo.updateAction(toStringValue(record(action).uuid), {
          state: 'SUCCEEDED',
          output: safeJson(result.output ?? {}),
          resultReference: result.reference ?? null,
          completedAt: new Date(),
          leaseUntil: null,
          claimedBy: null,
        });
        return { success: true, execution };
      }
      const decision = decideRetry(
        result.retryable,
        attempt,
        toFiniteNumber(record(action).maxAttempts, 3),
      );
      if (decision.retry) {
        await this.repo.updateAction(toStringValue(record(action).uuid), {
          state: 'RETRYABLE',
          availableAt: new Date(Date.now() + decision.delayMs),
          errorCode: result.errorCode ?? 'ACTION_RETRYABLE',
          errorMessage: result.errorMessage ?? 'Retryable action failure',
          leaseUntil: null,
          claimedBy: null,
        });
        return {
          success: false,
          execution: await this.repo.updateExecution(
            toStringValue(execution.uuid),
            {
              state: 'WAITING',
              retryAt: new Date(Date.now() + decision.delayMs),
              leaseUntil: null,
              claimedBy: null,
              lastErrorCode: result.errorCode ?? 'ACTION_RETRYABLE',
              lastErrorMessage:
                result.errorMessage ?? 'Retryable action failure',
            },
          ),
        };
      }
      await this.repo.updateAction(toStringValue(record(action).uuid), {
        state: 'FAILED',
        errorCode: result.errorCode ?? 'ACTION_FAILED',
        errorMessage: result.errorMessage ?? 'Action failed',
        completedAt: new Date(),
        leaseUntil: null,
        claimedBy: null,
      });
      return {
        success: false,
        execution: await this.failExecution(
          toStringValue(execution.uuid),
          result.errorCode ?? 'ACTION_FAILED',
          result.errorMessage ?? 'Action failed',
        ),
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message.slice(0, 500) : 'Action failed';
      const decision = decideRetry(
        true,
        attempt,
        toFiniteNumber(record(action).maxAttempts, 3),
      );
      if (decision.retry) {
        await this.repo.updateAction(toStringValue(record(action).uuid), {
          state: 'RETRYABLE',
          availableAt: new Date(Date.now() + decision.delayMs),
          errorCode: 'ACTION_EXCEPTION',
          errorMessage: message,
          leaseUntil: null,
          claimedBy: null,
        });
        return {
          success: false,
          execution: await this.repo.updateExecution(
            toStringValue(execution.uuid),
            {
              state: 'WAITING',
              retryAt: new Date(Date.now() + decision.delayMs),
              leaseUntil: null,
              claimedBy: null,
              lastErrorCode: 'ACTION_EXCEPTION',
              lastErrorMessage: message,
            },
          ),
        };
      }
      return {
        success: false,
        execution: await this.failExecution(
          toStringValue(execution.uuid),
          'ACTION_EXCEPTION',
          message,
        ),
      };
    }
  }

  private evaluateCondition(
    node: ConditionNode,
    context: Record<string, unknown>,
  ): boolean {
    const values = node.operands.map((operand) => {
      const actual = operand.field
        .split('.')
        .reduce<unknown>((value, key) => record(value)[key], context);
      switch (operand.operator) {
        case 'EQ':
          return actual === operand.expected;
        case 'NEQ':
          return actual !== operand.expected;
        case 'CONTAINS':
          return toStringValue(actual).includes(
            toStringValue(operand.expected),
          );
        case 'GT':
          return (
            toFiniteNumber(actual, Number.NaN) >
            toFiniteNumber(operand.expected, Number.NaN)
          );
        case 'GTE':
          return (
            toFiniteNumber(actual, Number.NaN) >=
            toFiniteNumber(operand.expected, Number.NaN)
          );
        case 'LT':
          return (
            toFiniteNumber(actual, Number.NaN) <
            toFiniteNumber(operand.expected, Number.NaN)
          );
        case 'LTE':
          return (
            toFiniteNumber(actual, Number.NaN) <=
            toFiniteNumber(operand.expected, Number.NaN)
          );
        case 'EXISTS':
          return actual !== null && actual !== undefined;
        case 'IN':
          return (
            Array.isArray(operand.expected) &&
            operand.expected.some(
              (expected) => toStringValue(expected) === toStringValue(actual),
            )
          );
        case 'TRUE':
          return actual === true;
        case 'FALSE':
          return actual === false;
        default:
          return false;
      }
    });
    if (node.children?.length)
      values.push(
        ...node.children.map((child) => this.evaluateCondition(child, context)),
      );
    if (node.operator === 'ALL') return values.every(Boolean);
    if (node.operator === 'ANY') return values.some(Boolean);
    return !values.some(Boolean);
  }

  private nextNode(
    edges: readonly { from: string; to: string }[],
    from: string,
    passed: boolean,
  ): string | null {
    const candidates = edges.filter((edge) => edge.from === from);
    return candidates.length <= 1
      ? (candidates[0]?.to ?? null)
      : (candidates[passed ? 0 : 1]?.to ?? null);
  }

  private async assertCapabilities(
    definition: WorkflowDefinition,
  ): Promise<void> {
    for (const node of definition.graph.nodes)
      if (node.type === 'ACTION') {
        if (!ACTION_TYPES.includes(node.actionType))
          throw new BadRequestException(
            `Unsupported action: ${node.actionType}`,
          );
        if (typeof node.input.userUuid === 'string' && node.input.userUuid) {
          const user = await this.users.getUser(node.input.userUuid);
          if (!user.isActive || user.deletedAt)
            throw new BadRequestException('Action target user is unavailable');
        }
      }
  }

  private async requireOwnedWorkflow(
    uuid: string,
    actorUuid: string,
  ): Promise<Record<string, unknown>> {
    const workflow = await this.repo.getWorkflow(uuid);
    if (!workflow) throw new NotFoundException('Workflow not found');
    if (toStringValue(workflow.ownerUserUuid) !== actorUuid)
      throw new ForbiddenException();
    return workflow;
  }

  private async requireExecution(
    uuid: string,
  ): Promise<Record<string, unknown>> {
    const execution = await this.repo.getExecution(uuid);
    if (!execution) throw new NotFoundException('Execution not found');
    return execution;
  }

  private async failExecution(uuid: string, code: string, message: string) {
    const result = await this.repo.updateExecution(uuid, {
      state: 'FAILED',
      completedAt: new Date(),
      leaseUntil: null,
      claimedBy: null,
      lastErrorCode: code,
      lastErrorMessage: message.slice(0, 500),
    });
    await this.auditRecord(
      'AUTOMATION_EXECUTION_FAILED',
      'automation_execution',
      uuid,
      undefined,
      code,
    );
    return result;
  }

  private async auditRecord(
    action: string,
    entityType: string,
    entityUuid: string,
    actorUuid?: string,
    reason?: string,
  ): Promise<void> {
    await this.audit.record({
      action,
      entityType,
      entityUuid,
      actorUuid,
      userUuid: actorUuid,
      actorType: actorUuid ? 'AUTHENTICATED' : 'SYSTEM',
      result: 'SUCCESS',
      reason,
      system: !actorUuid,
    });
  }
}
