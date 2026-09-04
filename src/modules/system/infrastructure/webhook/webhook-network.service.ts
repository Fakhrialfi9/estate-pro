import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const PRIVATE_IPV4_RANGES = [
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

const ipv4ToNumber = (value: string): number =>
  value.split('.').reduce((sum, octet) => (sum << 8) + Number(octet), 0) >>> 0;

const isBlockedIpv4 = (value: string): boolean => {
  const numeric = ipv4ToNumber(value);
  return PRIVATE_IPV4_RANGES.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (numeric & mask) === (ipv4ToNumber(base) & mask);
  });
};

const isBlockedIpv6 = (value: string): boolean => {
  const normalized = value.toLowerCase();
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb') ||
    normalized.startsWith('ff')
  );
};

@Injectable()
export class WebhookNetworkService {
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
    const isLocalhost =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';

    if (url.protocol !== 'https:' && !(allowLocalHttp && isLocalhost)) {
      throw new UnprocessableEntityException('Webhook endpoint must use HTTPS');
    }
    if (url.username || url.password) {
      throw new UnprocessableEntityException('Webhook endpoint must not include credentials');
    }
    if (url.hostname.toLowerCase().endsWith('.internal')) {
      throw new UnprocessableEntityException('Webhook endpoint targets a reserved hostname');
    }

    const ipType = isIP(url.hostname);
    if (ipType === 4 && isBlockedIpv4(url.hostname)) {
      throw new UnprocessableEntityException('Webhook endpoint targets a blocked network');
    }
    if (ipType === 6 && isBlockedIpv6(url.hostname)) {
      throw new UnprocessableEntityException('Webhook endpoint targets a blocked network');
    }

    if (ipType === 0) {
      let addresses: Awaited<ReturnType<typeof lookup>>[];
      try {
        addresses = await lookup(url.hostname, { all: true, verbatim: true });
      } catch {
        throw new UnprocessableEntityException('Webhook endpoint hostname cannot be resolved');
      }
      if (addresses.some((address) =>
        address.family === 4 ? isBlockedIpv4(address.address) : isBlockedIpv6(address.address),
      )) {
        throw new UnprocessableEntityException('Webhook endpoint resolves to a blocked network');
      }
    }

    return url;
  }
}
