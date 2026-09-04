import { describe, expect, it, vi, afterEach } from 'vitest';
import { WebhookNetworkService } from '../../../src/modules/system/infrastructure/webhook/webhook-network.service.js';

describe('WebhookNetworkService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('rejects plaintext public endpoints', async () => {
    const config = { get: vi.fn().mockReturnValue('false') };
    const service = new WebhookNetworkService(config as never);
    await expect(service.validateTarget('http://example.com/hook')).rejects.toThrow('must use HTTPS');
  });

  it('rejects loopback addresses', async () => {
    const config = { get: vi.fn().mockReturnValue('false') };
    const service = new WebhookNetworkService(config as never);
    await expect(service.validateTarget('https://127.0.0.1/hook')).rejects.toThrow('blocked network');
  });

  it('rejects URLs containing user credentials', async () => {
    const config = { get: vi.fn().mockReturnValue('false') };
    const service = new WebhookNetworkService(config as never);
    await expect(service.validateTarget('https://user:pass@example.com/hook')).rejects.toThrow('credentials');
  });
});
