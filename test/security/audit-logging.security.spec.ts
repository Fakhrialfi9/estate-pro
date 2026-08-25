import { describe, expect, it } from 'vitest';
import {
  sanitizeAuditChanges,
  sanitizeAuditReason,
} from '../../src/common/audit/audit-redaction.js';
import { AUDIT_ACTIONS } from '../../src/common/audit/audit-events.js';

describe('audit logging security policy', () => {
  it('uses the required event taxonomy', () => {
    expect(AUDIT_ACTIONS.AUTHENTICATION_SUCCESS).toBe('AUTHENTICATION_SUCCESS');
    expect(AUDIT_ACTIONS.AUTHENTICATION_FAILURE).toBe('AUTHENTICATION_FAILURE');
    expect(AUDIT_ACTIONS.USER_CREATED).toBe('USER_CREATED');
    expect(AUDIT_ACTIONS.ROLE_CREATED).toBe('ROLE_CREATED');
    expect(AUDIT_ACTIONS.PERMISSION_CREATED).toBe('PERMISSION_CREATED');
    expect(AUDIT_ACTIONS.SESSION_CREATED).toBe('SESSION_CREATED');
    expect(AUDIT_ACTIONS.TWO_FACTOR_ENABLED).toBe('TWO_FACTOR_ENABLED');
    expect(AUDIT_ACTIONS.AUDIT_LOG_ACCESSED).toBe('AUDIT_LOG_ACCESSED');
  });

  it('allowlists audit changes and excludes credentials and secrets', () => {
    const result = sanitizeAuditChanges('user', [
      {
        field: 'email',
        oldValue: 'old@example.com',
        newValue: 'new@example.com',
      },
      { field: 'password', oldValue: 'old-password', newValue: 'new-password' },
      { field: 'accessToken', oldValue: 'old-token', newValue: 'new-token' },
      { field: 'totpSecret', oldValue: 'old-secret', newValue: 'new-secret' },
      { field: 'isActive', oldValue: true, newValue: false },
    ]);
    expect(result).toEqual([
      {
        field: 'email',
        oldValue: 'old@example.com',
        newValue: 'new@example.com',
      },
      { field: 'isActive', oldValue: true, newValue: false },
    ]);
    expect(JSON.stringify(result)).not.toContain('password');
    expect(JSON.stringify(result)).not.toContain('token');
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('does not accept secret-bearing failure reasons', () => {
    expect(sanitizeAuditReason('INVALID_CREDENTIALS')).toBe(
      'INVALID_CREDENTIALS',
    );
    expect(sanitizeAuditReason('password=very-secret')).toBeNull();
    expect(sanitizeAuditReason('refresh-token=abc')).toBeNull();
  });
});
