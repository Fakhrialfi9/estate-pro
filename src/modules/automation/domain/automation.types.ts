export const WORKFLOW_STATUSES = [
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'ARCHIVED',
  'INVALID',
] as const;
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
  readonly entityType:
    | 'LEAD'
    | 'CONTACT'
    | 'OPPORTUNITY'
    | 'DEAL'
    | 'ACTIVITY'
    | 'SLA';
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
  readonly nodes: readonly (
    | ConditionNode
    | ActionNode
    | {
        readonly id: string;
        readonly type: 'TRIGGER';
        readonly trigger: TriggerDefinition;
      }
  )[];
  readonly edges: readonly { readonly from: string; readonly to: string }[];
  readonly maxDepth?: number;
}

export interface WorkflowDefinition {
  readonly trigger: TriggerDefinition;
  readonly graph: WorkflowGraph;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isOneOf = <const T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] => isString(value) && values.includes(value as T[number]);

const isEntityType = (
  value: unknown,
): value is TriggerDefinition['entityType'] =>
  isOneOf(
    ['LEAD', 'CONTACT', 'OPPORTUNITY', 'DEAL', 'ACTIVITY', 'SLA'] as const,
    value,
  );

const isConditionOperatorGroup = (
  value: unknown,
): value is ConditionNode['operator'] =>
  isOneOf(['ALL', 'ANY', 'NOT'] as const, value);

const isConditionOperand = (value: unknown): value is ConditionOperand => {
  if (!isObject(value)) return false;
  return (
    isOneOf(['EVENT', 'CRM', 'SALES', 'CONTEXT'] as const, value.source) &&
    isString(value.field) &&
    isOneOf(CONDITION_OPERATORS, value.operator)
  );
};

const isConditionNode = (value: unknown): value is ConditionNode =>
  isObject(value) &&
  isString(value.id) &&
  value.type === 'CONDITION' &&
  isConditionOperatorGroup(value.operator) &&
  Array.isArray(value.operands) &&
  value.operands.every(isConditionOperand) &&
  (value.children === undefined ||
    (Array.isArray(value.children) && value.children.every(isConditionNode)));

const isActionNode = (value: unknown): value is ActionNode =>
  isObject(value) &&
  isString(value.id) &&
  value.type === 'ACTION' &&
  isOneOf(ACTION_TYPES, value.actionType) &&
  isObject(value.input) &&
  (value.maxAttempts === undefined ||
    (typeof value.maxAttempts === 'number' &&
      Number.isInteger(value.maxAttempts))) &&
  (value.timeoutMs === undefined ||
    (typeof value.timeoutMs === 'number' && Number.isInteger(value.timeoutMs)));

const isTriggerNode = (
  value: unknown,
): value is {
  readonly id: string;
  readonly type: 'TRIGGER';
  readonly trigger: TriggerDefinition;
} => {
  if (!isObject(value) || !isString(value.id) || value.type !== 'TRIGGER')
    return false;
  if (!isObject(value.trigger)) return false;
  return (
    isOneOf(TRIGGER_TYPES, value.trigger.type) &&
    isEntityType(value.trigger.entityType)
  );
};

const isWorkflowDefinition = (value: unknown): value is WorkflowDefinition => {
  if (!isObject(value) || !isObject(value.trigger) || !isObject(value.graph))
    return false;
  const graph = value.graph;
  return (
    isOneOf(TRIGGER_TYPES, value.trigger.type) &&
    isEntityType(value.trigger.entityType) &&
    isString(graph.entryNodeId) &&
    Array.isArray(graph.nodes) &&
    graph.nodes.every(
      (node) =>
        isTriggerNode(node) || isConditionNode(node) || isActionNode(node),
    ) &&
    Array.isArray(graph.edges) &&
    graph.edges.every(
      (edge) => isObject(edge) && isString(edge.from) && isString(edge.to),
    )
  );
};

export const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

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
  if (!isWorkflowDefinition(value))
    throw new Error('Invalid workflow definition');
  return value;
};

export class WorkflowAggregate {
  constructor(
    readonly uuid: string,
    readonly ownerUserUuid: string,
    readonly name: string,
    private _status: WorkflowStatus = 'DRAFT',
  ) {}

  get status(): WorkflowStatus {
    return this._status;
  }

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

  get state(): ExecutionState {
    return this._state;
  }

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

  get state(): ActionState {
    return this._state;
  }

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
    return {
      retry: false,
      delayMs: 0,
      terminalState: attempt >= maxAttempts ? 'DEAD_LETTER' : 'FAILED',
    };
  const exponent = Math.max(0, attempt - 1);
  const delayMs = Math.min(maxDelayMs, baseDelayMs * 2 ** exponent);
  return { retry: true, delayMs, terminalState: 'FAILED' };
};
