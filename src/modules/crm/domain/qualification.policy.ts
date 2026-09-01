export interface QualificationDecision {
  readonly qualified: boolean;
  readonly score: number;
  readonly reason: string;
}

export class QualificationPolicy {
  evaluate(score: number, reason: string): QualificationDecision {
    const normalizedReason = reason.trim();
    if (!normalizedReason) throw new Error('Qualification reason is required');
    return {
      qualified: score > 0,
      score,
      reason: normalizedReason.slice(0, 255),
    };
  }
}
