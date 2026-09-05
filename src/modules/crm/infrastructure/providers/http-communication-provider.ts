import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { CommunicationProvider } from './communication-provider.js';

const DEFAULT_TIMEOUT_MS = 10_000;

export class HttpCommunicationProvider implements CommunicationProvider {
  constructor(
    readonly channel: 'EMAIL' | 'WHATSAPP' | 'SMS',
    private readonly endpoint: string,
    private readonly bearerToken?: string,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {}

  async send(input: {
    destination: string;
    subject?: string;
    body: string;
    idempotencyKey: string;
  }): Promise<{ providerMessageId: string }> {
    await assertPublicHttpsUrl(this.endpoint);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    timer.unref();

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'idempotency-key': input.idempotencyKey,
          ...(this.bearerToken
            ? { authorization: `Bearer ${this.bearerToken}` }
            : {}),
        },
        body: JSON.stringify({
          channel: this.channel,
          to: input.destination,
          subject: input.subject ?? null,
          body: input.body,
        }),
        redirect: 'error',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Communication provider returned HTTP ${response.status}`);
      }

      const text = await response.text();
      const payload = parseObject(text);
      const providerMessageId =
        stringValue(payload?.providerMessageId) ??
        stringValue(payload?.messageId) ??
        stringValue(payload?.id) ??
        response.headers.get('x-message-id');

      if (!providerMessageId) {
        throw new Error('Communication provider response omitted message id');
      }

      return { providerMessageId };
    } finally {
      clearTimeout(timer);
    }
  }
}

export async function assertPublicHttpsUrl(raw: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Communication provider URL is invalid');
  }

  if (url.protocol !== 'https:') {
    throw new Error('Communication provider URL must use HTTPS');
  }
  if (url.username || url.password) {
    throw new Error('Communication provider URL cannot contain credentials');
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Communication provider URL cannot target localhost');
  }
  if (isPrivateAddress(hostname)) {
    throw new Error('Communication provider URL cannot target a private network');
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error('Communication provider URL resolves to a private network');
  }
}

function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 192 && b === 168) ||
      (a === 172 && b >= 16 && b <= 31)
    );
  }
  return version === 6 &&
    (address === '::1' || /^(fc|fd|fe80:)/i.test(address));
}

function parseObject(text: string): Record<string, unknown> | null {
  if (!text.trim()) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
