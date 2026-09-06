import type { UserPublicPort } from '../../../common/contracts/user-public.port.js';
import type { AutomationOpportunityContext } from '../../../common/contracts/automation-sales.port.js';
import type { AutomationLeadContext } from '../../../common/contracts/automation-crm.port.js';
import type {
  ActionState,
  ExecutionState,
  TriggerDefinition,
  WorkflowDefinition,
} from './automation.types.js';

export interface AutomationEvent {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly actorUuid?: string | null;
  readonly entityType:
    | 'LEAD'
    | 'CONTACT'
    | 'OPPORTUNITY'
    | 'DEAL'
    | 'ACTIVITY'
    | 'SLA';
  readonly entityUuid: string;
  readonly action?: string;
  readonly version: number;
  readonly payload: Record<string, unknown>;
}

export interface AutomationRepository {
  createWorkflow(this: void, input: {
    uuid: string;
    name: string;
    description?: string | null;
    ownerUserUuid: string;
    createdBy: string;
    updatedBy: string;
  }): Promise<Record<string, unknown>>;
  updateWorkflow(
    this: void,
    uuid: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  getWorkflow(this: void, uuid: string): Promise<Record<string, unknown> | null>;
  listWorkflows(this: void, input: Record<string, unknown>): Promise<{
    items: readonly Record<string, unknown>[];
    total: number;
    page: number;
    limit: number;
  }>;
  createVersion(this: void, input: {
    uuid: string;
    workflowUuid: string;
    version: number;
    status: string;
    triggerDefinition: TriggerDefinition;
    definition: WorkflowDefinition;
    checksum: string;
    createdBy: string;
    activatedAt?: Date | null;
  }): Promise<Record<string, unknown>>;
  getVersion(
    this: void,
    uuid: string,
  ): Promise<Record<string, unknown> | null>;
  listActiveVersions(this: void): Promise<readonly Record<string, unknown>[]>;
  updateVersion(
    this: void,
    uuid: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  createExecution(
    this: void,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  getExecution(
    this: void,
    uuid: string,
  ): Promise<Record<string, unknown> | null>;
  listExecutions(this: void, input: Record<string, unknown>): Promise<{
    items: readonly Record<string, unknown>[];
    total: number;
    page: number;
    limit: number;
  }>;
  updateExecution(
    this: void,
    uuid: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  createAction(
    this: void,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  getAction(this: void, uuid: string): Promise<Record<string, unknown> | null>;
  listActions(
    this: void,
    executionUuid: string,
  ): Promise<readonly Record<string, unknown>[]>;
  updateAction(
    this: void,
    uuid: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  claimDueExecution(
    this: void,
    workerId: string,
    leaseMs: number,
  ): Promise<Record<string, unknown> | null>;
  claimDueAction(
    this: void,
    workerId: string,
    leaseMs: number,
  ): Promise<Record<string, unknown> | null>;
  reclaimExpired(this: void, workerId: string, now: Date): Promise<number>;
  countRecentActionExecutions(
    this: void,
    workflowUuid: string,
    entityUuid: string,
    since: Date,
  ): Promise<number>;
  createAssignmentRule(
    this: void,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  createSlaPolicy(
    this: void,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  createSlaInstance(
    this: void,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  claimDueSla(
    this: void,
    workerId: string,
    leaseMs: number,
  ): Promise<Record<string, unknown> | null>;
  updateSlaInstance(
    this: void,
    uuid: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  createEscalationPolicy(
    this: void,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  getEscalationPolicy(
    this: void,
    uuid: string,
  ): Promise<Record<string, unknown> | null>;
  createNotification(
    this: void,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  listNotifications(this: void, input: {
    userUuid: string;
    page: number;
    limit: number;
    unreadOnly: boolean;
  }): Promise<{ items: readonly Record<string, unknown>[]; total: number }>;
  markNotificationRead(
    this: void,
    uuid: string,
    userUuid: string,
  ): Promise<Record<string, unknown> | null>;
}

export interface WorkflowContextProvider {
  getLead(uuid: string): Promise<AutomationLeadContext>;
  getActivity(uuid: string): Promise<Record<string, unknown>>;
  getOpportunity(uuid: string): Promise<AutomationOpportunityContext>;
  getUser: UserPublicPort['getUser'];
}

export interface AuditPort {
  record(input: Record<string, unknown>): Promise<unknown>;
}

export interface ActionHandler {
  readonly actionType: string;
  execute(
    input: Record<string, unknown>,
    context: Record<string, unknown>,
    actorUuid: string,
  ): Promise<{
    success: boolean;
    retryable: boolean;
    reference?: string;
    output?: Record<string, unknown>;
    errorCode?: string;
    errorMessage?: string;
  }>;
}

export type SupportedAutomationContext = Record<string, unknown>;
export type SupportedExecutionState = ExecutionState;
export type SupportedActionState = ActionState;
