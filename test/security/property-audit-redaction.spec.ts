import { describe, expect, it } from 'vitest';
import {
  sanitizeAuditChanges,
  sanitizeAuditReason,
} from '../../src/common/audit/audit-redaction.js';

describe('Property audit redaction', () => {
  it('keeps approved property lifecycle fields and drops sensitive fields', () => {
    const changes = sanitizeAuditChanges('property', [
      { field: 'title', oldValue: 'Old', newValue: 'New' },
      { field: 'status', oldValue: 'DRAFT', newValue: 'ACTIVE' },
      { field: 'password', oldValue: 'x', newValue: 'y' },
      { field: 'ownerReference', oldValue: 'secret', newValue: 'secret2' },
    ]);

    expect(changes).toEqual([
      { field: 'title', oldValue: 'Old', newValue: 'New' },
      { field: 'status', oldValue: 'DRAFT', newValue: 'ACTIVE' },
    ]);
  });

  it('allows safe financial metadata but never secrets', () => {
    const changes = sanitizeAuditChanges('property_financial', [
      { field: 'currency', oldValue: 'IDR', newValue: 'USD' },
      { field: 'askingPrice', oldValue: '100000', newValue: '200000' },
      { field: 'apiKey', oldValue: 'a', newValue: 'b' },
    ]);

    expect(changes).toHaveLength(2);
    expect(changes.map((item) => item.field)).toEqual([
      'currency',
      'askingPrice',
    ]);
  });

  it('drops unsafe free-form audit reasons', () => {
    expect(sanitizeAuditReason('password=secret')).toBeNull();
    expect(sanitizeAuditReason('OK_REASON')).toBe('OK_REASON');
  });
});
