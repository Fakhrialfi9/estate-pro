import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { AutomationEvent, AutomationRepository, WorkflowContextProvider, AuditPort, ActionHandler } from '../../domain/automation.ports.js';
import type { TriggerType } from '../../domain/automation.types.js';
import { TRIGGER_TYPES } from '../../domain/automation.types.js';
import { WorkflowValidator, parseDefinition } from '../validation/workflow-validator.js';

const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const unknownArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const recordArray = (value: unknown): Record<string, unknown>[] =>
  unknownArray(value).map(record);

const stringArray = (value: unknown): string[] =>
  unknownArray(value).filter((item): item is string => typeof item === 'string');

const toStringValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
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
  if (typeof value !== 'string') throw new BadRequestException(`Invalid ${field}`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`Invalid ${field}`);
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

const isTriggerType = (value: unknown): value is TriggerType => {
  if (typeof value !== 'string') return false;
  return TRIGGER_TYPES.some((item) => item === value);
};

@Injectable()
export class AutomationService {
  constructor(
    private readonly repo: AutomationRepository,
    private readonly validator: WorkflowValidator,
    private readonly contextProvider: WorkflowContextProvider,
    private readonly audit: AuditPort,
    private readonly config: ConfigService,
    private readonly actions: readonly ActionHandler[],
  ) {}

  async createWorkflow(
    input: { name: string; description?: string },
    actorUuid: string,
  ): Promise<Record<string, unknown>> {
    if (!input.name.trim()) throw new BadRequestException('Workflow name is required');
    return this.repo.createWorkflow({
      uuid: randomUUID(),
      name: input.name.trim().slice(0, 180),
      description: input.description?.trim() ?? null,
      ownerUserUuid: actorUuid,
      createdBy: actorUuid,
      updatedBy: actorUuid,
    });
  }

  async updateWorkflow(
    uuid: string,
    input: { name?: string; description?: string },
    actorUuid: string,
  ): Promise<Record<string, unknown>> {
    const workflow = await this.requireOwnedWorkflow(uuid, actorUuid);
    if (workflow.status !== 'DRAFT') throw new ConflictException('Only draft workflows can be edited');
    const patch: Record<string, unknown> = { updatedBy: actorUuid };
    if (input.name !== undefined) {
      if (!input.name.trim()) throw new BadRequestException('Workflow name is required');
      patch.name = input.name.trim().slice(0, 180);
    }
    if (input.description !== undefined) patch.description = input.description.trim();
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
    for (const item of unknownArray(workflow.versions)) version = Math.max(version, toFiniteNumber(record(item).version));
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

  async publishActivate(workflowUuid: string, versionUuid: string, actorUuid: string) {
    const workflow = await this.requireOwnedWorkflow(workflowUuid, actorUuid);
    const version = await this.repo.getVersion(versionUuid);
    if (!version || toStringValue(version.workflowUuid) !== workflowUuid) throw new NotFoundException('Workflow version not found');
    if (version.status !== 'DRAFT') throw new BadRequestException('Only draft versions can be activated');
    const definition = parseDefinition(version.definition);
    this.validator.validate(definition);
    await this.assertCapabilities(definition);
    await this.repo.updateVersion(versionUuid, { status: 'ACTIVE', activatedAt: new Date() });
    if (workflow.activeVersionUuid && toStringValue(workflow.activeVersionUuid) !== versionUuid) {
      const previousVersionUuid = toStringValue(workflow.activeVersionUuid);
      const previous = await this.repo.getVersion(previousVersionUuid);
      if (previous?.status === 'ACTIVE') await this.repo.updateVersion(previousVersionUuid, { status: 'PAUSED' });
    }
    const result = await this.repo.updateWorkflow(workflowUuid, {
      status: 'ACTIVE',
      activeVersionUuid: versionUuid,
      updatedBy: actorUuid,
    });
    await this.auditRecord('AUTOMATION_WORKFLOW_ACTIVATED', 'automation_workflow', workflowUuid, actorUuid, `version=${toStringValue(version.version)}`);
    return result;
  }

  async pauseWorkflow(uuid: string, actorUuid: string) {
    await this.requireOwnedWorkflow(uuid, actorUuid);
    const result = await this.repo.updateWorkflow(uuid, { status: 'PAUSED', updatedBy: actorUuid });
    await this.auditRecord('AUTOMATION_WORKFLOW_PAUSED', 'automation_workflow', uuid, actorUuid);
    return result;
  }

  async archiveWorkflow(uuid: string, actorUuid: string) {
    await this.requireOwnedWorkflow(uuid, actorUuid);
    const result = await this.repo.updateWorkflow(uuid, { status: 'ARCHIVED', updatedBy: actorUuid });
    await this.auditRecord('AUTOMATION_WORKFLOW_ARCHIVED', 'automation_workflow', uuid, actorUuid);
    return result;
  }

  async dispatch(event: AutomationEvent) {
    const active = await this.repo.listActiveVersions();
    const created: Record<string, unknown>[] = [];
    for (const version of active) {
      const trigger = record(version.triggerDefinition);
      if (!this.triggerMatches(trigger, event)) continue;
      const workflow = await this.repo.getWorkflow(toStringValue(version.workflowUuid));
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
      await this.auditRecord('AUTOMATION_EXECUTION_CREATED', 'automation_execution', toStringValue(execution.uuid), event.actorUuid ?? undefined, `workflow=${toStringValue(version.workflowUuid)}`);
    }
    return created;
  }

  async processDue(workerId: string, leaseMs = 30_000) {
    const execution = await this.repo.claimDueExecution(workerId, leaseMs);
    return execution ? this.executeWorkflow(execution, workerId) : null;
  }

  async retryExecution(uuid: string, actorUuid: string) {
    const execution = await this.requireExecution(uuid);
    if (!['FAILED', 'DEAD_LETTER'].includes(toStringValue(execution.state))) throw new BadRequestException('Execution is not retryable');
    for (const action of (await this.repo.listActions(uuid)).filter((value) => ['FAILED', 'RETRYABLE'].includes(toStringValue(record(value).state)))) {
      await this.repo.updateAction(toStringValue(record(action).uuid), { state: 'RETRYABLE', availableAt: new Date(), errorCode: null, errorMessage: null });
    }
    const updated = await this.repo.updateExecution(uuid, { state: 'WAITING', retryAt: new Date(), lastErrorCode: null, lastErrorMessage: null, claimedBy: null, leaseUntil: null });
    await this.auditRecord('AUTOMATION_EXECUTION_RETRIED', 'automation_execution', uuid, actorUuid);
    return updated;
  }

  async cancelExecution(uuid: string, actorUuid: string) {
    const execution = await this.requireExecution(uuid);
    if (!['PENDING', 'RUNNING', 'WAITING'].includes(toStringValue(execution.state))) throw new BadRequestException('Execution is not cancellable');
    const updated = await this.repo.updateExecution(uuid, { state: 'CANCELLED', completedAt: new Date(), claimedBy: null, leaseUntil: null });
    await this.auditRecord('AUTOMATION_EXECUTION_CANCELLED', 'automation_execution', uuid, actorUuid);
    return updated;
  }

  listWorkflows(query: unknown, actorUuid: string) {
    return this.repo.listWorkflows({ ...record(query), ownerUserUuid: actorUuid });
  }

  getWorkflow(uuid: string, actorUuid: string) {
    return this.requireOwnedWorkflow(uuid, actorUuid);
  }

  listExecutions(query: unknown, actorUuid: string) {
    return this.repo.listExecutions({ ...record(query), ownerUserUuid: actorUuid });
  }

  async getExecution(uuid: string, actorUuid: string) {
    const execution = await this.requireExecution(uuid);
    const workflow = await this.repo.getWorkflow(toStringValue(execution.workflowUuid));
    if (!workflow || toStringValue(workflow.ownerUserUuid) !== actorUuid) throw new ForbiddenException();
    return execution;
  }

  async createAssignmentRule(workflowUuid: string, input: unknown, actorUuid: string) {
    await this.requireOwnedWorkflow(workflowUuid, actorUuid);
    const data = record(input);
    const strategy = toStringValue(data.strategy, 'FIXED_USER');
    if (!['ROUND_ROBIN', 'FIXED_USER', 'FIXED_TEAM', 'LEAST_LOAD'].includes(strategy)) throw new BadRequestException('Unsupported assignment strategy');
    return this.repo.createAssignmentRule({
      uuid: randomUUID(), workflowUuid, name: toStringValue(data.name, 'Assignment rule').slice(0, 180), criteria: record(data.criteria), strategy, fallback: data.fallback === undefined ? null : record(data.fallback), activeFrom: toDateValue(data.activeFrom, 'activeFrom'), activeUntil: toDateValue(data.activeUntil, 'activeUntil'), isActive: data.isActive !== false,
    });
  }

  async createSlaPolicy(workflowUuid: string, input: unknown, actorUuid: string) {
    await this.requireOwnedWorkflow(workflowUuid, actorUuid);
    const data = record(input);
    const duration = toFiniteNumber(data.durationMinutes, Number.NaN);
    if (!Number.isInteger(duration) || duration <= 0 || duration > 525600) throw new BadRequestException('Invalid SLA duration');
    const targetEntityType = toStringValue(data.targetEntityType);
    const startEventType = toStringValue(data.startEventType);
    if (!targetEntityType || !startEventType) throw new BadRequestException('SLA target and start event are required');
    return this.repo.createSlaPolicy({
      uuid: randomUUID(), workflowUuid, name: toStringValue(data.name, 'SLA').slice(0, 180), targetEntityType, startEventType, stopEventTypes: stringArray(data.stopEventTypes), durationMinutes: duration, timezone: toStringValue(data.timezone, 'UTC'), businessHours: record(data.businessHours ?? { enabled: false }), isActive: data.isActive !== false, version: 1,
    });
  }

  async createEscalationPolicy(workflowUuid: string, input: unknown, actorUuid: string) {
    await this.requireOwnedWorkflow(workflowUuid, actorUuid);
    const data = record(input);
    const levels = recordArray(data.levels);
    if (levels.length === 0 || levels.length > 10) throw new BadRequestException('Escalation requires 1-10 levels');
    const maxAttempts = Math.min(10, Math.max(1, toFiniteNumber(data.maxAttempts, 3)));
    const cooldownSeconds = Math.max(1, toFiniteNumber(data.cooldownSeconds, 3600));
    return this.repo.createEscalationPolicy({
      uuid: randomUUID(), workflowUuid, name: toStringValue(data.name, 'Escalation').slice(0, 180), levels, maxAttempts, cooldownSeconds, isActive: data.isActive !== false,
    });
  }

  async dashboard(actorUuid: string) {
    const [workflows, executions] = await Promise.all([
      this.repo.listWorkflows({ ownerUserUuid: actorUuid, page: 1, limit: 100 }),
      this.repo.listExecutions({ ownerUserUuid: actorUuid, page: 1, limit: 100 }),
    ]);
    const list = executions.items;
    const count = (state: string) => list.filter((item) => toStringValue(record(item).state) === state).length;
    return {
      data: {
        workflowCount: workflows.total,
        executionCount: executions.total,
        pending: count('PENDING'),
        running: count('RUNNING'),
        succeeded: count('SUCCEEDED'),
        failed: count('FAILED'),
        retried: list.filter((item) => toFiniteNumber(record(item).attemptCount) > 0).length,
      },
    };
  }

  private triggerMatches(trigger: Record<string, unknown>, event: AutomationEvent): boolean {
    if (!isTriggerType(trigger.type) || toStringValue(trigger.entityType) !== event.entityType) return false;
    const type = trigger.type;
    const action = toStringValue(event.action);
    const mappings: Record<TriggerType, string[]> = {
      ENTITY_CREATED: ['created', 'CREATE'], ENTITY_UPDATED: ['updated', 'UPDATE'], STATUS_CHANGED: ['status_changed', 'STATUS_CHANGED'], ASSIGNED: ['assigned', 'ASSIGNED'], SCORE_CHANGED: ['score_changed', 'SCORE_CHANGED'], DUE: ['due', 'DUE'], SCHEDULED: ['scheduled', 'SCHEDULED'], SLA_BREACHED: ['sla_breached', 'SLA_BREACHED'], INBOUND_INTENT: ['inbound_intent', 'INBOUND_INTENT'],
    };
    return action === '' || (mappings[type] ?? []).includes(action);
  }

  private async resolveContext(event: AutomationEvent): Promise<Record<string, unknown>> {
    const context: Record<string, unknown> = { eventId: event.eventId, occurredAt: event.occurredAt.toISOString(), actorUuid: event.actorUuid ?? undefined, entityUuid: event.entityUuid, entityType: event.entityType, action: event.action };
    if (event.entityType === 'LEAD') context.lead = await this.contextProvider.getLead(event.entityUuid);
    if (event.entityType === 'ACTIVITY') context.activity = await this.contextProvider.getActivity(event.entityUuid);
    if (event.entityType === 'OPPORTUNITY' || event.entityType === 'DEAL') context.opportunity = await this.contextProvider.getOpportunity(event.entityUuid);
    if (event.actorUuid) context.actor = await this.contextProvider.getUser(event.actorUuid);
    return safeJson(context);
  }

  private async executeWorkflow(execution: Record<string, unknown>, workerId: string) {
    const executionUuid = toStringValue(execution.uuid);
    const definition = record(execution.definition);
    const graph = record(definition.graph);
    const nodes = recordArray(graph.nodes);
    const currentNodeId = toStringValue(execution.currentNodeId);
    const node = nodes.find((item) => toStringValue(item.id) === currentNodeId);
    if (!node) return this.repo.updateExecution(executionUuid, { state: 'FAILED', lastErrorCode: 'NODE_NOT_FOUND', lastErrorMessage: 'Workflow node not found', claimedBy: workerId, leaseUntil: null });
    const context = record(execution.contextSnapshot);
    const nodeType = toStringValue(node.type);
    if (nodeType === 'ACTION') await this.runAction(node, context, toStringValue(execution.actorUuid ?? ''));
    return this.repo.updateExecution(executionUuid, { state: 'SUCCEEDED', completedAt: new Date(), claimedBy: null, leaseUntil: null });
  }

  private async runAction(node: Record<string, unknown>, context: Record<string, unknown>, actorUuid: string) {
    const actionType = toStringValue(node.actionType);
    const handler = this.actions.find((candidate) => candidate.actionType === actionType);
    if (!handler) throw new BadRequestException(`Unsupported action type: ${actionType}`);
    const input = record(node.input);
    return handler.execute(input, context, actorUuid);
  }

  private async assertCapabilities(definition: unknown): Promise<void> {
    void definition;
  }

  private async requireOwnedWorkflow(uuid: string, actorUuid: string): Promise<Record<string, unknown>> {
    const workflow = await this.repo.getWorkflow(uuid);
    if (!workflow) throw new NotFoundException('Workflow not found');
    if (toStringValue(workflow.ownerUserUuid) !== actorUuid) throw new ForbiddenException();
    return workflow;
  }

  private async requireExecution(uuid: string): Promise<Record<string, unknown>> {
    const execution = await this.repo.getExecution(uuid);
    if (!execution) throw new NotFoundException('Execution not found');
    return execution;
  }

  private async auditRecord(action: string, entityType: string, entityUuid: string, actorUuid?: string, reason?: string): Promise<void> {
    await this.audit.record({ action, entityType, entityUuid, actorUuid, reason });
  }
}
