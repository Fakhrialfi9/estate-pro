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
} from '../../domain/automation.types.js';

const hasOwn = (obj: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

@Injectable()
export class WorkflowValidator {
  validate(definition: WorkflowDefinition): void {
    if (!definition?.trigger || !definition.graph)
      throw new BadRequestException('Workflow requires trigger and graph');
    if (!TRIGGER_TYPES.includes(definition.trigger.type))
      throw new BadRequestException('Unsupported trigger type');
    if (
      !['LEAD', 'CONTACT', 'OPPORTUNITY', 'DEAL', 'ACTIVITY', 'SLA'].includes(
        definition.trigger.entityType,
      )
    )
      throw new BadRequestException('Unsupported trigger entity type');
    const nodes = definition.graph.nodes;
    const edges = definition.graph.edges;
    if (!Array.isArray(nodes) || nodes.length === 0)
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
      if (!NODE_TYPES.includes(node.type))
        throw new BadRequestException(`Unsupported node type: ${node.type}`);
      if (node.type === 'TRIGGER') {
        if (node.id !== definition.graph.entryNodeId)
          throw new BadRequestException('Trigger node must be the entry node');
        continue;
      }
      if (node.type === 'CONDITION')
        this.validateCondition(node as ConditionNode);
      if (node.type === 'ACTION') {
        if (!ACTION_TYPES.includes(node.actionType))
          throw new BadRequestException(
            `Unsupported action type: ${node.actionType}`,
          );
        if (
          !node.input ||
          typeof node.input !== 'object' ||
          Array.isArray(node.input)
        )
          throw new BadRequestException('Action input must be an object');
        const maxAttempts = node.maxAttempts ?? 3;
        if (
          !Number.isInteger(maxAttempts) ||
          maxAttempts < 1 ||
          maxAttempts > 10
        )
          throw new BadRequestException('Invalid action retry limit');
        if (
          node.timeoutMs !== undefined &&
          (!Number.isInteger(node.timeoutMs) ||
            node.timeoutMs < 100 ||
            node.timeoutMs > 300_000)
        )
          throw new BadRequestException('Invalid action timeout');
      }
    }
    const adjacency = new Map<string, string[]>();
    for (const edge of edges ?? []) {
      if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to)
        throw new BadRequestException('Workflow contains an invalid edge');
      adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);
    }
    this.assertAcyclic(adjacency, ids, definition.graph.entryNodeId);
    for (const node of nodes)
      if (
        node.id !== definition.graph.entryNodeId &&
        !edges.some((edge) => edge.to === node.id)
      )
        throw new BadRequestException(`Orphan node: ${node.id}`);
  }

  checksum(definition: WorkflowDefinition): string {
    this.validate(definition);
    return createHash('sha256').update(canonicalize(definition)).digest('hex');
  }

  private validateCondition(node: ConditionNode): void {
    if (!['ALL', 'ANY', 'NOT'].includes(node.operator))
      throw new BadRequestException('Invalid condition group operator');
    if (!Array.isArray(node.operands))
      throw new BadRequestException('Condition operands must be an array');
    if (node.operands.length > 20)
      throw new BadRequestException('Condition operand limit exceeded');
    for (const operand of node.operands) {
      if (!operand.field || !CONDITION_OPERATORS.includes(operand.operator))
        throw new BadRequestException('Unsupported condition operand');
      if (operand.operator !== 'EXISTS' && !hasOwn(operand, 'expected'))
        throw new BadRequestException('Condition expected value is required');
      if (!['EVENT', 'CRM', 'SALES', 'CONTEXT'].includes(operand.source))
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
