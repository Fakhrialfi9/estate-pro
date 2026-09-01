export type LeadLifecycleAction = 'QUALIFY' | 'NURTURE' | 'REACTIVATE' | 'CLOSE';

const ACTIVE_STATUSES = new Set(['NEW', 'CONTACTED', 'NURTURING']);
const CLOSED_STATUSES = new Set(['CLOSED_WON', 'CLOSED_LOST', 'ARCHIVED']);

export class LeadLifecyclePolicy {
  assertCan(action: LeadLifecycleAction, status: string): void {
    if (!status) throw new Error('Lead status is required');
    if (action === 'QUALIFY' && !ACTIVE_STATUSES.has(status)) {
      throw new Error(`Lead status ${status} cannot be qualified`);
    }
    if (action === 'NURTURE' && CLOSED_STATUSES.has(status)) {
      throw new Error(`Lead status ${status} cannot be nurtured`);
    }
    if (action === 'REACTIVATE' && !CLOSED_STATUSES.has(status)) {
      throw new Error(`Lead status ${status} is not eligible for reactivation`);
    }
    if (action === 'CLOSE' && CLOSED_STATUSES.has(status)) {
      throw new Error(`Lead status ${status} is already closed`);
    }
  }
}
