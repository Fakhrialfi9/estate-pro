import { describe, expect, it } from 'vitest';
import { assertSafeOutboundUrl, UnsafeOutboundUrlError } from '../../../src/common/security/outbound-url-policy.js';

describe('assertSafeOutboundUrl', () => {
  it('allows a public HTTPS IP literal', async () => {
    await expect(assertSafeOutboundUrl('https://8.8.8.8/health')).resolves.toBe(
      'https://8.8.8.8/health',
    );
  });

  it.each([
    'https://127.0.0.1',
    'https://10.0.0.1',
    'https://169.254.169.254/latest/meta-data',
    'https://192.168.1.1',
    'https://[::1]',
    'https://[fc00::1]',
  ])('rejects private or link-local target %s', async (url) => {
    await expect(assertSafeOutboundUrl(url)).rejects.toBeInstanceOf(
      UnsafeOutboundUrlError,
    );
  });

  it('rejects embedded credentials', async () => {
    await expect(
      assertSafeOutboundUrl('https://user:password@8.8.8.8'),
    ).rejects.toThrow('credentials');
  });

  it('rejects plain HTTP by default', async () => {
    await expect(assertSafeOutboundUrl('http://8.8.8.8')).rejects.toThrow(
      'HTTPS',
    );
  });
});
