import { describe, expect, it } from 'vitest';
import { sanitizeSystemCorrelationContext } from '../../src/common/observability/system-context.js';

describe('system correlation context', () => {
  it('bounds correlation identifiers without altering their semantic identity', () => {
    const value = sanitizeSystemCorrelationContext({
      requestId: 'request-1',
      correlationId: 'correlation-1',
      jobId: 'job-1',
    });
    expect(value).toEqual({
      requestId: 'request-1',
      correlationId: 'correlation-1',
      jobId: 'job-1',
    });
  });
});
