import type { LeadStatusCode } from './entities/lead.entity.js';

const transitions: Readonly<Record<LeadStatusCode, readonly LeadStatusCode[]>> =
  {
    NEW: ['CONTACTED', 'ARCHIVED'],
    CONTACTED: ['QUALIFIED', 'NURTURING', 'CLOSED_LOST', 'ARCHIVED'],
    QUALIFIED: ['NURTURING', 'CLOSED_WON', 'CLOSED_LOST', 'ARCHIVED'],
    NURTURING: [
      'CONTACTED',
      'QUALIFIED',
      'CLOSED_WON',
      'CLOSED_LOST',
      'ARCHIVED',
    ],
    CLOSED_WON: ['CONTACTED'],
    CLOSED_LOST: ['CONTACTED'],
    ARCHIVED: ['CONTACTED'],
  };

export function canTransition(
  from: LeadStatusCode,
  to: LeadStatusCode,
): boolean {
  return transitions[from].includes(to);
}

export function allowedTransitions(
  from: LeadStatusCode,
): readonly LeadStatusCode[] {
  return transitions[from];
}
