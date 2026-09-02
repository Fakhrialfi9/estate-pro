export const WORKFLOW_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED', 'INVALID'] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const EXECUTION_STATES = [
  'PENDING',
  'RUNNING',
  'WAITING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'DEAD_LETTER',
] as const;
export type ExecutionState = (typeof EXECUTION_STATES)[number];

export const ACTION_STATES = [
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'SKIPPED',
  'RETRYABLE',
] as const;
export type ActionState = (typeof ACTION_STATES)[number];

export const TRIGGER_TYPES = [
  'ENTITY_CREATED',
  'ENTITY_UPDATED',
  'STATUS_CHANGED',
  'ASSIGNED',
  'SCORE_CHANGED',
  'DUE',
  'SCHEDULED',
  'SLA_BREACHED',
  'INBOUND_INTENT',
] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const NODE_TYPES = ['TRIGGER', 'CONDITION', 'ACTION'] as const;
export type WorkflowNodeType = (typeof NODE_TYPES)[number];

export const CONDITION_OPERATORS = [
  'EQ',
  'NEQ',
  'CONTAINS',
  'GT',
  'GTE',
  'LT',
  'LTE',
  'EXISTS',
  'IN',
  'TRUE',
  'FALSE',
] as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export const ACTION_TYPES = [
  'ASSIGN_LEAD',
  'REFRESH_LEAD_SCORE',
  'CREATE_ACTIVITY',
  'ENQUEUE_COMMUNICATION',
  'NOTIFY',
  'ESCALATE',
  'REQUEST_STATUS_TRANSITION',
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export interface TriggerDefinition {
  readonly type: TriggerType;
  readonly entityType: 'LEAD' | 'CONTACT' | 'OPPORTUNITY' | 'DEAL' | 'ACTIVITY' | 'SLA';
  readonly eventAction?: string;
  readonly field?: string;
  readonly value?: string | number | boolean | null;
}

export interface ConditionOperand {
  readonly source: 'EVENT' | 'CRM' | 'SALES' | 'CONTEXT';
  readonly field: string;
  readonly operator: ConditionOperator;
  readonly expected?: unknown;
}

export interface ConditionNode {
  readonly id: string;
  readonly type: 'CONDITION';
  readonly operator: 'ALL' | 'ANY' | 'NOT';
  readonly operands: readonly ConditionOperand[];
  readonly children?: readonly ConditionNode[];
}

export interface ActionNode {
  readonly id: string;
  readonly type: 'ACTION';
  readonly actionType: ActionType;
  readonly input: Record<string, unknown>;
  readonly maxAttempts?: number;
  readonly timeoutMs?: number;
}

export interface WorkflowGraph {
  readonly entryNodeId: string;
  readonly nodes: readonly (ConditionNode | ActionNode | { readonly id: string; readonly type: 'TRIGGER'; readonly trigger: TriggerDefinition; })[];
  readonly edges: readonly { readonly from: string; readonly to: string }[];
  readonly maxDepth?: number;
}

export interface WorkflowDefinition {
  readonly trigger: TriggerDefinition;
  readonly graph: WorkflowGraph;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const canonicalize = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (isObject(value)) {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
};

export const parseDefinition = (value: unknown): WorkflowDefinition => {
  if (!isObject(value)) throw new Error('Workflow definition must be an object');
  if (!isObject(value.trigger) || !isObject(value.graph))
    throw new Error('Workflow definition requires trigger and graph');
  return value as unknown as WorkflowDefinition;
};

export class WorkflowAggregate {
  constructor(
    readonly uuid: string,
    readonly ownerUserUuid: string,
    readonly name: string,
    private _status: WorkflowStatus = 'DRAFT',
  ) {}

  get status(): WorkflowStatus { return this._status; }

  transition(next: WorkflowStatus): void {
    if (this._status === next) return;
    const allowed: Record<WorkflowStatus, readonly WorkflowStatus[]> = {
      DRAFT: ['ACTIVE', 'ARCHIVED', 'INVALID'],
      ACTIVE: ['PAUSED', 'ARCHIVED'],
      PAUSED: ['ACTIVE', 'ARCHIVED'],
      ARCHIVED: [],
      INVALID: ['DRAFT', 'ARCHIVED'],
    };
    if (!allowed[this._status].includes(next))
      throw new Error(`Invalid workflow transition ${this._status} -> ${next}`);
    this._status = next;
  }
}

export class WorkflowExecutionAggregate {
  constructor(
    readonly uuid: string,
    readonly workflowVersionUuid: string,
    readonly eventId: string,
    private _state: ExecutionState = 'PENDING',
  ) {}

  get state(): ExecutionState { return this._state; }

  transition(next: ExecutionState): void {
    const allowed: Record<ExecutionState, readonly ExecutionState[]> = {
      PENDING: ['RUNNING', 'CANCELLED'],
      RUNNING: ['WAITING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'DEAD_LETTER'],
      WAITING: ['RUNNING', 'FAILED', 'CANCELLED', 'DEAD_LETTER'],
      SUCCEEDED: [],
      FAILED: ['WAITING', 'RUNNING', 'DEAD_LETTER'],
      CANCELLED: [],
      DEAD_LETTER: ['RUNNING'],
    };
    if (!allowed[this._state].includes(next))
      throw new Error(`Invalid execution transition ${this._state} -> ${next}`);
    this._state = next;
  }
}

export class ActionExecutionAggregate {
  constructor(
    readonly uuid: string,
    readonly nodeId: string,
    readonly actionType: ActionType,
    private _state: ActionState = 'PENDING',
  ) {}

  get state(): ActionState { return this._state; }

  transition(next: ActionState): void {
    const allowed: Record<ActionState, readonly ActionState[]> = {
      PENDING: ['RUNNING', 'SKIPPED'],
      RUNNING: ['SUCCEEDED', 'FAILED', 'RETRYABLE', 'SKIPPED'],
      RETRYABLE: ['RUNNING', 'FAILED'],
      FAILED: ['RETRYABLE'],
      SUCCEEDED: [],
      SKIPPED: [],
    };
    if (!allowed[this._state].includes(next))
      throw new Error(`Invalid action transition ${this._state} -> ${next}`);
    this._state = next;
  }
}

export interface RetryDecision {
  readonly retry: boolean;
  readonly delayMs: number;
  readonly terminalState: 'FAILED' | 'DEAD_LETTER';
}

export const decideRetry = (
  retryable: boolean,
  attempt: number,
  maxAttempts: number,
  baseDelayMs = 1000,
  maxDelayMs = 300_000,
): RetryDecision => {
  if (!retryable || attempt >= maxAttempts)
    return { retry: false, delayMs: 0, terminalState: attempt >= maxAttempts ? 'DEAD_LETTER' : 'FAILED' };
  const delayMs = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1));
  return { retry: true, delayMs, terminalState: 'FAILED' };
};

export const assertSafeDepth = (depth: number, maxDepth = 20): void => {
  if (!Number.isInteger(depth) || depth < 0 || depth > maxDepth)
    throw new Error('Workflow execution depth exceeded safety limit');
};
