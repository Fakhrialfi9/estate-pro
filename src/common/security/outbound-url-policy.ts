import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class UnsafeOutboundUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeOutboundUrlError';
  }
}

const BLOCKED_IPV4: ReadonlyArray<readonly [number, number]> = [
  [ipv4('0.0.0.0'), 8],
  [ipv4('10.0.0.0'), 8],
  [ipv4('100.64.0.0'), 10],
  [ipv4('127.0.0.0'), 8],
  [ipv4('169.254.0.0'), 16],
  [ipv4('172.16.0.0'), 12],
  [ipv4('192.0.0.0'), 24],
  [ipv4('192.0.2.0'), 24],
  [ipv4('192.168.0.0'), 16],
  [ipv4('198.18.0.0'), 15],
  [ipv4('198.51.100.0'), 24],
  [ipv4('203.0.113.0'), 24],
  [ipv4('224.0.0.0'), 4],
  [ipv4('240.0.0.0'), 4],
];

export async function assertSafeOutboundUrl(
  rawUrl: string,
  options: {
    allowHttp?: boolean;
    allowedHosts?: readonly string[];
  } = {},
): Promise<string> {
  const url = parseUrl(rawUrl);
  const hostname = normalizeHostname(url.hostname);
  const allowedHosts = new Set(
    (options.allowedHosts ?? []).map((host) => normalizeHostname(host)),
  );
  const explicitlyAllowed = matchesAllowedHost(hostname, allowedHosts);

  if (url.username || url.password)
    throw new UnsafeOutboundUrlError(
      'Outbound URL must not contain credentials',
    );

  if (url.protocol !== 'https:' && !(options.allowHttp === true && explicitlyAllowed)) {
    throw new UnsafeOutboundUrlError('Outbound URL must use HTTPS');
  }
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new UnsafeOutboundUrlError('Outbound URL cannot target localhost');
  }
  if (hostname.endsWith('.internal') || hostname.endsWith('.local')) {
    throw new UnsafeOutboundUrlError('Outbound URL targets a reserved hostname');
  }

  const family = isIP(hostname);
  if (family) {
    if (!isSafeIp(hostname))
      throw new UnsafeOutboundUrlError('Outbound URL targets a blocked network');
    return url.toString();
  }

  if (allowedHosts.size > 0 && !explicitlyAllowed)
    throw new UnsafeOutboundUrlError('Outbound URL hostname is not allowlisted');

  let addresses: Awaited<ReturnType<typeof lookup>>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UnsafeOutboundUrlError(
      'Outbound URL hostname cannot be resolved',
    );
  }

  if (
    addresses.length === 0 ||
    addresses.some((entry) => !isSafeIp(entry.address))
  ) {
    throw new UnsafeOutboundUrlError(
      'Outbound URL resolves to a blocked network',
    );
  }

  return url.toString();
}

export async function assertSafeOutboundUrlWithoutAllowlist(
  rawUrl: string,
): Promise<string> {
  return assertSafeOutboundUrl(rawUrl);
}

function parseUrl(rawUrl: string): URL {
  try {
    return new URL(rawUrl);
  } catch {
    throw new UnsafeOutboundUrlError('Outbound URL is invalid');
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
}

function matchesAllowedHost(hostname: string, allowedHosts: ReadonlySet<string>): boolean {
  for (const allowed of allowedHosts) {
    if (hostname === allowed || hostname.endsWith(`.${allowed}`)) return true;
  }
  return false;
}

function isSafeIp(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !isBlockedIpv4(address);
  if (family === 6) return !isBlockedIpv6(address);
  return false;
}

function isBlockedIpv4(address: string): boolean {
  const value = ipv4(address);
  return BLOCKED_IPV4.some(([base, bits]) => {
    const mask = (0xffffffff << (32 - bits)) >>> 0;
    return (value & mask) === (base & mask);
  });
}

function isBlockedIpv6(address: string): boolean {
  const normalized = normalizeHostname(address);
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
    (normalized.startsWith('::ffff:') &&
      !isSafeIp(normalized.slice('::ffff:'.length)))
  );
}

function ipv4(value: string): number {
  return value
    .split('.')
    .map(Number)
    .reduce((sum, octet) => ((sum << 8) | octet) >>> 0, 0);
}
