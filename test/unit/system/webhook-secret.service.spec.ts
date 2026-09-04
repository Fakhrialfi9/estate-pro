import { describe, expect, it, vi } from 'vitest';
import { WebhookSecretService } from '../../../src/modules/system/infrastructure/webhook/webhook-secret.service.js';

describe('WebhookSecretService', () => {
  it('generates random secrets and decrypts encrypted storage value', () => {
    const config = {
      get: vi.fn((key: string, fallback?: string) =>
        key === 'system.webhookEncryptionKey'
          ? 'test-webhook-encryption-key-abcdefghijklmnopqrstuvwxyz'
          : fallback,
      ),
    };
    const service = new WebhookSecretService(config as never);
    const generated = service.generate();
    expect(generated.secret).toMatch(/^whsec_/);
    expect(service.decrypt(generated.ciphertext)).toBe(generated.secret);
    expect(generated.ciphertext).not.toContain(generated.secret);
  });
});
