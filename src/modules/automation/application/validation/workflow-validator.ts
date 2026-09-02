import { Injectable } from '@nestjs/common';
import {
  ACTION_TYPES,
  CONDITION_OPERATORS,
  NODE_TYPES,
  TRIGGER_TYPES,
  canonicalize,
  isUuid,
  type ConditionNode,
  type WorkflowDefinition,
} from '../../domain/automation.types.js';
import { createHash } from 'node:crypto';

const hasOwn = (obj: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

@Injectable()
export class WorkflowValidator {
  validate(definition: WorkflowDefinition): void {
    if (!definition?.trigger || !definition.graph)
      throw new Error('Workflow requires trigger and graph');
    const trigger = definition.trigger;
    if (!TRIGGER_TYPES.includes(trigger.type)) throw new Error('Unsupported trigger type');
    if (!['LEAD', 'CONTACT', 'OPPORTUNITY', 'DEAL', 'ACTIVITY', 'SLA'].includes(trigger.entityType))
      throw new Error('Unsupported trigger entity type');
    const nodes = definition.graph.nodes;
    const edges = definition.graph.edges;
    if (!Array.isArray(nodes) || nodes.length === 0) throw new Error('Workflow must contain nodes');
    if (nodes.length > 100) throw new Error('Workflow node limit exceeded');
    if (!nodes.some((node) => node.type === 'TRIGGER')) throw new Error('Workflow requires a trigger node');
    const ids = new Set<string>();
    for (const node of nodes) {
      if (!node.id || ids.has(node.id)) throw new Error('Workflow node ids must be unique');
      ids.add(node.id);
      if (!NODE_TYPES.includes(node.type)) throw new Error(`Unsupported node type: ${node.type}`);
      if (node.type === 'TRIGGER') {
        if (node.id !== definition.graph.entryNodeId) throw new Error('Trigger node must be the entry node');
        continue;
      }
      if (node.type === 'CONDITION') this.validateCondition(node as ConditionNode);
      if (node.type === 'ACTION') {
        if (!ACTION_TYPES.includes(node.actionType)) throw new Error(`Unsupported action type: ${node.actionType}`);
        if (!node.input || typeof node.input !== 'object' || Array.isArray(node.input)) throw new Error('Action input must be an object');
        const maxAttempts = node.maxAttempts ?? 3;
        if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) throw new Error('Invalid action retry limit');
        if (node.timeoutMs !== undefined && (!Number.isInteger(node.timeoutMs) || node.timeoutMs < 100 || node.timeoutMs > 300_000))
          throw new Error('Invalid action timeout');
      }
    }
    const adjacency = new Map<string, string[]>();
    for (const edge of edges ?? []) {
      if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) throw new Error('Workflow contains an invalid edge');
      adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);
    }
    this.assertAcyclic(adjacency, ids, definition.graph.entryNodeId);
    for (const node of nodes) {
      if (node.id === definition.graph.entryNodeId) continue;
      if (!edges.some((edge) => edge.to === node.id)) throw new Error(`Orphan node: ${node.id}`);
    }
  }

  checksum(definition: WorkflowDefinition): string {
    this.validate(definition);
    return createHash('sha256').update(canonicalize(definition)).digest('hex');
  }

  private validateCondition(node: ConditionNode): void {
    if (!['ALL', 'ANY', 'NOT'].includes(node.operator)) throw new Error('Invalid condition group operator');
    if (!Array.isArray(node.operands)) throw new Error('Condition operands must be an array');
    if (node.operands.length > 20) throw new Error('Condition operand limit exceeded');
    for (const operand of node.operands) {
      if (!operand.field || !CONDITION_OPERATORS.includes(operand.operator)) throw new Error('Unsupported condition operand');
      if (operand.operator !== 'EXISTS' && !hasOwn(operand, 'expected')) throw new Error('Condition expected value is required');
      if (!['EVENT', 'CRM', 'SALES', 'CONTEXT'].includes(operand.source)) throw new Error('Unsupported condition source');
    }
    for (const child of node.children ?? []) this.validateCondition(child);
  }

  private assertAcyclic(adjacency: Map<string, string[]>, ids: Set<string>, entry: string): void {
    if (!ids.has(entry)) throw new Error('Workflow entry node does not exist');
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (id: string): void => {
      if (visiting.has(id)) throw new Error('Workflow graph contains a cycle');
      if (visited.has(id)) return;
      visiting.add(id);
      for (const next of adjacency.get(id) ?? []) visit(next);
      visiting.delete(id);
      visited.add(id);
    };
    visit(entry);
  }
}
