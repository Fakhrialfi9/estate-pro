import { describe, expect, it, vi } from 'vitest';
import { SystemActivityService } from '../../src/modules/system/application/services/system-activity.service.js';

describe('SystemActivityService', () => {
  it('redacts sensitive metadata before persistence', async () => {
    const append = vi.fn().mockResolvedValue({});
    const service = new SystemActivityService({ append } as never);
    await service.append({ eventType: 'TEST', category: 'SYSTEM', summary: 'Test', metadata: { token: 'secret', nested: { password: 'secret' }, safe: 'value' } });
    expect(append).toHaveBeenCalledWith(expect.objectContaining({ metadata: { token: '[REDACTED]', nested: { password: '[REDACTED]' }, safe: 'value' } }));
  });

  it('rejects incomplete events', async () => {
    const service = new SystemActivityService({ append: vi.fn() } as never);
    await expect(service.append({ eventType: '', category: 'SYSTEM', summary: 'x' })).rejects.toThrow();
  });
});
