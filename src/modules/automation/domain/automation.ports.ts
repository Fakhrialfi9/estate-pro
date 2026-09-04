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
  createWorkflow(input: {
    uuid: string;
    name: string;
    description?: string | null;
    ownerUserUuid: string;
    createdBy: string;
    updatedBy: string;
  }): Promise<Record<string, unknown>>;
  updateWorkflow(
    uuid: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  getWorkflow(uuid: string): Promise<Record<string, unknown> | null>;
  listWorkflows(input: Record<string, unknown>): Promise<{
    items: readonly Record<string, unknown>[];
    total: number;
    page: number;
    limit: number;
  }>;
  createVersion(input: {
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
  getVersion(uuid: string): Promise<Record<string, unknown> | null>;
  listActiveVersions(): Promise<readonly Record<string, unknown>[]>;
  updateVersion(
    uuid: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  createExecution(
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  getExecution(uuid: string): Promise<Record<string, unknown> | null>;
  listExecutions(input: Record<string, unknown>): Promise<{
    items: readonly Record<string, unknown>[];
    total: number;
    page: number;
    limit: number;
  }>;
  updateExecution(
    uuid: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  createAction(
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  getAction(uuid: string): Promise<Record<string, unknown> | null>;
  listActions(
    executionUuid: string,
  ): Promise<readonly Record<string, unknown>[]>;
  updateAction(
    uuid: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  claimDueExecution(
    workerId: string,
    leaseMs: number,
  ): Promise<Record<string, unknown> | null>;
  claimDueAction(
    workerId: string,
    leaseMs: number,
  ): Promise<Record<string, unknown> | null>;
  reclaimExpired(workerId: string, now: Date): Promise<number>;
  countRecentActionExecutions(
    workflowUuid: string,
    entityUuid: string,
    since: Date,
  ): Promise<number>;
  createAssignmentRule(
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  createSlaPolicy(
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  createSlaInstance(
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  claimDueSla(
    workerId: string,
    leaseMs: number,
  ): Promise<Record<string, unknown> | null>;
  updateSlaInstance(
    uuid: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  createEscalationPolicy(
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  getEscalationPolicy(uuid: string): Promise<Record<string, unknown> | null>;
  createNotification(
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  listNotifications(input: {
    userUuid: string;
    page: number;
    limit: number;
    unreadOnly: boolean;
  }): Promise<{ items: readonly Record<string, unknown>[]; total: number }>;
  markNotificationRead(
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
