import { describe, expect, it } from 'vitest';
import { ActionExecutionAggregate, WorkflowAggregate, WorkflowExecutionAggregate, decideRetry } from '../../../src/modules/automation/domain/automation.types.js';
import { WorkflowValidator } from '../../../src/modules/automation/application/validation/workflow-validator.js';

describe('automation domain', () => {
  it('enforces workflow lifecycle transitions', () => {
    const workflow = new WorkflowAggregate('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Lead follow-up');
    workflow.transition('ACTIVE');
    expect(workflow.status).toBe('ACTIVE');
    workflow.transition('PAUSED');
    expect(workflow.status).toBe('PAUSED');
    expect(() => workflow.transition('DRAFT')).toThrow();
  });

  it('enforces execution and action terminal states', () => {
    const execution = new WorkflowExecutionAggregate('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003');
    execution.transition('RUNNING'); execution.transition('SUCCEEDED');
    expect(() => execution.transition('RUNNING')).toThrow();
    const action = new ActionExecutionAggregate('00000000-0000-4000-8000-000000000004', 'a1', 'NOTIFY');
    action.transition('RUNNING'); action.transition('RETRYABLE'); action.transition('RUNNING');
    expect(() => action.transition('SKIPPED')).toThrow();
  });

  it('classifies retryable and terminal failures deterministically', () => {
    expect(decideRetry(true, 1, 3)).toMatchObject({ retry: true, delayMs: 1000 });
    expect(decideRetry(true, 3, 3)).toMatchObject({ retry: false, terminalState: 'DEAD_LETTER' });
    expect(decideRetry(false, 1, 3)).toMatchObject({ retry: false, terminalState: 'FAILED' });
  });

  it('rejects unsafe workflow graphs', () => {
    const validator = new WorkflowValidator();
    expect(() => validator.validate({
      trigger: { type: 'ENTITY_CREATED', entityType: 'LEAD' },
      graph: {
        entryNodeId: 'trigger',
        nodes: [
          { id: 'trigger', type: 'TRIGGER', trigger: { type: 'ENTITY_CREATED', entityType: 'LEAD' } },
          { id: 'action', type: 'ACTION', actionType: 'NOTIFY', input: { userUuid: '00000000-0000-4000-8000-000000000001', title: 'Hi', body: 'Safe' } },
        ],
        edges: [{ from: 'trigger', to: 'action' }],
      },
    })).not.toThrow();

    expect(() => validator.validate({
      trigger: { type: 'ENTITY_CREATED', entityType: 'LEAD' },
      graph: {
        entryNodeId: 'trigger',
        nodes: [
          { id: 'trigger', type: 'TRIGGER', trigger: { type: 'ENTITY_CREATED', entityType: 'LEAD' } },
          { id: 'action', type: 'ACTION', actionType: 'NOTIFY', input: {} },
        ],
        edges: [{ from: 'trigger', to: 'action' }, { from: 'action', to: 'trigger' }],
      },
    })).toThrow('cycle');
  });

  it('produces stable definition fingerprints', () => {
    const validator = new WorkflowValidator();
    const definition = {
      trigger: { type: 'ENTITY_CREATED' as const, entityType: 'LEAD' as const },
      graph: { entryNodeId: 'trigger', nodes: [{ id: 'trigger', type: 'TRIGGER' as const, trigger: { type: 'ENTITY_CREATED' as const, entityType: 'LEAD' as const } }], edges: [] },
    };
    expect(validator.checksum(definition)).toBe(validator.checksum({ graph: definition.graph, trigger: definition.trigger }));
  });
});
