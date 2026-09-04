import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SystemWebhookNetworkPort } from '../../domain/webhook/webhook.ports.js';

const PRIVATE_IPV4_RANGES = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const;

const stripIpv6Brackets = (value: string): string =>
  value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value;

const ipv4ToNumber = (value: string): number =>
  value.split('.').reduce((sum, octet) => (sum << 8) + Number(octet), 0) >>> 0;

const isBlockedIpv4 = (value: string): boolean => {
  const numeric = ipv4ToNumber(value);
  return PRIVATE_IPV4_RANGES.some(([base, bits]) => {
    const mask = (0xffffffff << (32 - bits)) >>> 0;
    return (numeric & mask) === (ipv4ToNumber(base) & mask);
  });
};

const isBlockedIpv6 = (value: string): boolean => {
  const normalized = stripIpv6Brackets(value).toLowerCase();
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb') ||
    normalized.startsWith('ff') ||
    (normalized.startsWith('::ffff:') && isBlockedIpv4(normalized.slice(7)))
  );
};

const isSafeAddress = (address: string): boolean => {
  const family = isIP(address);
  return family === 4
    ? !isBlockedIpv4(address)
    : family === 6
      ? !isBlockedIpv6(address)
      : false;
};

@Injectable()
export class WebhookNetworkService implements SystemWebhookNetworkPort {
  constructor(private readonly config: ConfigService) {}

  async validateTarget(rawUrl: string): Promise<URL> {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new UnprocessableEntityException('Webhook endpoint URL is invalid');
    }

    const allowLocalHttp =
      this.config.get<string>('system.allowLocalWebhookHttp') === 'true';
    const hostname = stripIpv6Brackets(url.hostname);
    const isLocalhost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1';

    if (url.protocol !== 'https:' && !(allowLocalHttp && isLocalhost)) {
      throw new UnprocessableEntityException('Webhook endpoint must use HTTPS');
    }
    if (url.username || url.password) {
      throw new UnprocessableEntityException(
        'Webhook endpoint must not include credentials',
      );
    }
    if (hostname.toLowerCase().endsWith('.internal')) {
      throw new UnprocessableEntityException(
        'Webhook endpoint targets a reserved hostname',
      );
    }

    const family = isIP(hostname);
    if (family && !isSafeAddress(hostname)) {
      throw new UnprocessableEntityException(
        'Webhook endpoint targets a blocked network',
      );
    }

    if (!family) {
      let addresses;
      try {
        addresses = await lookup(hostname, { all: true, verbatim: true });
      } catch {
        throw new UnprocessableEntityException(
          'Webhook endpoint hostname cannot be resolved',
        );
      }
      if (
        addresses.length === 0 ||
        addresses.some((address) => !isSafeAddress(address.address))
      ) {
        throw new UnprocessableEntityException(
          'Webhook endpoint resolves to a blocked network',
        );
      }
    }

    return url;
  }

  async send(input: {
    endpoint: string;
    payload: string;
    headers: Readonly<Record<string, string>>;
    timeoutMs: number;
  }): Promise<{ status: number }> {
    await this.validateTarget(input.endpoint);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
    try {
      const response = await fetch(input.endpoint, {
        method: 'POST',
        redirect: 'manual',
        headers: input.headers,
        body: input.payload,
        signal: controller.signal,
      });
      return { status: response.status };
    } finally {
      clearTimeout(timeout);
    }
  }
}
