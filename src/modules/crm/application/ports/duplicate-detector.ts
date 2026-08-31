import { Injectable } from '@nestjs/common';
import {
  duplicatePairKey,
  normalizeEmail,
  normalizePhone,
} from '../../domain/crm.types.js';

export interface DuplicateCandidate {
  readonly leadUuid: string;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly displayName?: string | null;
}
export interface DuplicateMatch {
  readonly pairKey: string;
  readonly candidateLeadUuid: string;
  readonly confidence: number;
  readonly signals: readonly string[];
}
@Injectable()
export class DuplicateDetector {
  detect(
    source: DuplicateCandidate,
    candidates: readonly DuplicateCandidate[],
  ): readonly DuplicateMatch[] {
    const email = source.email ? normalizeEmail(source.email) : null;
    const phone = source.phone ? normalizePhone(source.phone) : null;
    const name = source.displayName?.trim().toLocaleLowerCase() ?? '';
    return candidates
      .filter((c) => c.leadUuid !== source.leadUuid)
      .map((candidate) => {
        const signals: string[] = [];
        let confidence = 0;
        if (
          email &&
          candidate.email &&
          normalizeEmail(candidate.email) === email
        ) {
          confidence += 60;
          signals.push('EMAIL');
        }
        if (
          phone &&
          candidate.phone &&
          normalizePhone(candidate.phone) === phone
        ) {
          confidence += 30;
          signals.push('PHONE');
        }
        if (
          name &&
          candidate.displayName?.trim().toLocaleLowerCase() === name
        ) {
          confidence += 20;
          signals.push('NAME');
        }
        return { candidate, confidence, signals };
      })
      .filter((x) => x.confidence >= 40)
      .map((x) => ({
        pairKey: duplicatePairKey(source.leadUuid, x.candidate.leadUuid),
        candidateLeadUuid: x.candidate.leadUuid,
        confidence: x.confidence,
        signals: x.signals,
      }));
  }
}
