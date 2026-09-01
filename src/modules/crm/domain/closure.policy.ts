export type ClosureOutcome = 'WON' | 'LOST' | 'DISQUALIFIED' | 'OTHER';

export interface ClosureDecision {
  readonly reason: string;
  readonly outcome: ClosureOutcome;
}

export class ClosurePolicy {
  decide(reason: string, outcome: ClosureOutcome): ClosureDecision {
    const normalizedReason = reason.trim();
    if (!normalizedReason) throw new Error('Closure reason is required');
    return { reason: normalizedReason.slice(0, 255), outcome };
  }
}
