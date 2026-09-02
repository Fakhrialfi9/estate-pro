import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  ACTION_TYPES,
  CONDITION_OPERATORS,
  NODE_TYPES,
  TRIGGER_TYPES,
  canonicalize,
  type ConditionNode,
  type WorkflowDefinition,
  type WorkflowGraph,
} from '../../domain/automation.types.js';

const hasOwn = (obj: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isValueIn = <const T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] => isString(value) && values.includes(value);

const isWorkflowNode = (
  value: unknown,
): value is WorkflowGraph['nodes'][number] => {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !isValueIn(NODE_TYPES, value.type)
  )
    return false;

  if (value.type === 'TRIGGER') return isRecord(value.trigger);

  if (value.type === 'CONDITION') {
    return (
      isValueIn(['ALL', 'ANY', 'NOT'] as const, value.operator) &&
      Array.isArray(value.operands) &&
      value.operands.every(isRecord)
    );
  }

  return isValueIn(ACTION_TYPES, value.actionType) && isRecord(value.input);
};

const assertDefinitionShape = (
  definition: unknown,
): asserts definition is WorkflowDefinition => {
  if (!isRecord(definition))
    throw new BadRequestException('Workflow definition must be an object');
  if (!isRecord(definition.trigger) || !isRecord(definition.graph))
    throw new BadRequestException('Workflow requires trigger and graph');

  if (
    !isValueIn(TRIGGER_TYPES, definition.trigger.type) ||
    !isString(definition.trigger.entityType)
  )
    throw new BadRequestException('Workflow trigger is invalid');

  if (
    !Array.isArray(definition.graph.nodes) ||
    !definition.graph.nodes.every(isWorkflowNode)
  )
    throw new BadRequestException('Workflow nodes are invalid');

  if (!Array.isArray(definition.graph.edges))
    throw new BadRequestException('Workflow edges must be an array');

  if (
    !isString(definition.graph.entryNodeId) ||
    !definition.graph.nodes.some(
      (node) => node.id === definition.graph.entryNodeId,
    )
  )
    throw new BadRequestException('Workflow entry node does not exist');
};

@Injectable()
export class WorkflowValidator {
  validate(definition: unknown): asserts definition is WorkflowDefinition {
    assertDefinitionShape(definition);

    if (
      !isValueIn(
        ['LEAD', 'CONTACT', 'OPPORTUNITY', 'DEAL', 'ACTIVITY', 'SLA'] as const,
        definition.trigger.entityType,
      )
    )
      throw new BadRequestException('Unsupported trigger entity type');

    const nodes = definition.graph.nodes;
    const edges = definition.graph.edges;
    if (nodes.length === 0)
      throw new BadRequestException('Workflow must contain nodes');
    if (nodes.length > 100)
      throw new BadRequestException('Workflow node limit exceeded');
    if (!nodes.some((node) => node.type === 'TRIGGER'))
      throw new BadRequestException('Workflow requires a trigger node');

    const ids = new Set<string>();
    for (const node of nodes) {
      if (!node.id || ids.has(node.id))
        throw new BadRequestException('Workflow node ids must be unique');
      ids.add(node.id);

      if (node.type === 'TRIGGER') {
        if (node.id !== definition.graph.entryNodeId)
          throw new BadRequestException('Trigger node must be the entry node');
        continue;
      }

      if (node.type === 'CONDITION') {
        this.validateCondition(node);
        continue;
      }

      if (!isValueIn(ACTION_TYPES, node.actionType))
        throw new BadRequestException(
          `Unsupported action type: ${node.actionType}`,
        );

      const maxAttempts = node.maxAttempts ?? 3;
      if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10)
        throw new BadRequestException('Invalid action retry limit');

      if (
        node.timeoutMs !== undefined &&
        (!Number.isInteger(node.timeoutMs) ||
          node.timeoutMs < 100 ||
          node.timeoutMs > 300_000)
      )
        throw new BadRequestException('Invalid action timeout');
    }

    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
      if (
        !isRecord(edge) ||
        !isString(edge.from) ||
        !isString(edge.to) ||
        !ids.has(edge.from) ||
        !ids.has(edge.to) ||
        edge.from === edge.to
      )
        throw new BadRequestException('Workflow contains an invalid edge');
      adjacency.set(edge.from, [
        ...(adjacency.get(edge.from) ?? []),
        edge.to,
      ]);
    }

    this.assertAcyclic(adjacency, ids, definition.graph.entryNodeId);

    for (const node of nodes)
      if (
        node.id !== definition.graph.entryNodeId &&
        !edges.some((edge) => isRecord(edge) && edge.to === node.id)
      )
        throw new BadRequestException(`Orphan node: ${node.id}`);
  }

  checksum(definition: unknown): string {
    this.validate(definition);
    return createHash('sha256').update(canonicalize(definition)).digest('hex');
  }

  private validateCondition(node: ConditionNode): void {
    if (!isValueIn(['ALL', 'ANY', 'NOT'] as const, node.operator))
      throw new BadRequestException('Invalid condition group operator');
    if (!Array.isArray(node.operands))
      throw new BadRequestException('Condition operands must be an array');
    if (node.operands.length > 20)
      throw new BadRequestException('Condition operand limit exceeded');

    for (const operand of node.operands) {
      if (
        !isString(operand.field) ||
        !isValueIn(CONDITION_OPERATORS, operand.operator)
      )
        throw new BadRequestException('Unsupported condition operand');
      if (operand.operator !== 'EXISTS' && !hasOwn(operand, 'expected'))
        throw new BadRequestException('Condition expected value is required');
      if (
        !isValueIn(
          ['EVENT', 'CRM', 'SALES', 'CONTEXT'] as const,
          operand.source,
        )
      )
        throw new BadRequestException('Unsupported condition source');
    }

    for (const child of node.children ?? []) this.validateCondition(child);
  }

  private assertAcyclic(
    adjacency: Map<string, string[]>,
    ids: Set<string>,
    entry: string,
  ): void {
    if (!ids.has(entry))
      throw new BadRequestException('Workflow entry node does not exist');
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (id: string): void => {
      if (visiting.has(id))
        throw new BadRequestException('Workflow graph contains a cycle');
      if (visited.has(id)) return;
      visiting.add(id);
      for (const next of adjacency.get(id) ?? []) visit(next);
      visiting.delete(id);
      visited.add(id);
    };
    visit(entry);
  }
}
