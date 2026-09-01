import { describe, expect, it } from 'vitest';
import {
  calculateCommission,
  calculateForecastAmount,
  dealTransitionAllowed,
  isUuid,
  negotiationTransitionAllowed,
  offerTransitionAllowed,
  parseMoney,
  transitionAllowed,
  viewingTransitionAllowed,
} from './sales.types.js';

describe('Sales domain primitives', () => {
  it('validates UUIDs', () => {
    expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
  });

  it('validates bounded monetary input', () => {
    expect(parseMoney('100.2500')).toBe(100.25);
    expect(() => parseMoney('-1')).toThrow();
    expect(() => parseMoney('1.12345')).toThrow();
  });

  it('enforces state machines', () => {
    expect(transitionAllowed('OPEN', 'QUALIFIED')).toBe(true);
    expect(transitionAllowed('OPEN', 'CLOSED')).toBe(false);
    expect(viewingTransitionAllowed('REQUESTED', 'CONFIRMED')).toBe(true);
    expect(negotiationTransitionAllowed('ACTIVE', 'ACCEPTED')).toBe(true);
    expect(offerTransitionAllowed('SUBMITTED', 'ACCEPTED')).toBe(true);
    expect(dealTransitionAllowed('READY_TO_CLOSE', 'CLOSED')).toBe(true);
    expect(dealTransitionAllowed('CLOSED', 'OPEN')).toBe(false);
  });

  it('calculates commission precisely at four decimal places', () => {
    expect(calculateCommission('100000.0000', '2.5000')).toBe('2500.0000');
    expect(calculateCommission('99999.9999', '2.5000')).toBe('2499.9999');
  });

  it('calculates weighted forecast deterministically', () => {
    expect(calculateForecastAmount('100000.0000', 25)).toBe('25000.0000');
  });
});
