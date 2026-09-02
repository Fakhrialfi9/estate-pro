import { describe, expect, it } from 'vitest';
import { isAgentAssignable, isUserEligibleForAgent } from '../../src/modules/agent-management/domain/agent-eligibility.policy.js';

const user = { uuid: 'u-1', status: 'ACTIVE', isActive: true, deletedAt: null };

describe('agent eligibility policy', () => {
  it('requires an active non-deleted user with agent permission', () => {
    expect(isUserEligibleForAgent({ user, hasAgentAccess: true })).toBe(true);
    expect(isUserEligibleForAgent({ user: { ...user, isActive: false }, hasAgentAccess: true })).toBe(false);
    expect(isUserEligibleForAgent({ user: { ...user, deletedAt: new Date() }, hasAgentAccess: true })).toBe(false);
    expect(isUserEligibleForAgent({ user, hasAgentAccess: false })).toBe(false);
  });

  it('fails closed for suspended, unavailable, or full agents', () => {
    const snapshot = { user, hasAgentAccess: true, agentStatus: 'ACTIVE' };
    expect(isAgentAssignable(snapshot, 'ACTIVE', 1)).toBe(true);
    expect(isAgentAssignable(snapshot, 'LEAVE', 1)).toBe(false);
    expect(isAgentAssignable({ ...snapshot, agentStatus: 'SUSPENDED' }, 'ACTIVE', 1)).toBe(false);
    expect(isAgentAssignable(snapshot, 'ACTIVE', 0)).toBe(false);
  });
});
