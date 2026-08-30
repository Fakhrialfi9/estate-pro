import { registerAs } from '@nestjs/config';

const isProduction = process.env.NODE_ENV === 'production';
const cspEnabled = process.env.SECURITY_CSP_ENABLED === 'true';
const hstsEnabled =
  process.env.SECURITY_HSTS_ENABLED === 'true' || isProduction;

export default registerAs('security', () => ({
  helmet: {
    contentSecurityPolicy: cspEnabled,
    frameguard: { action: 'deny' as const },
    noSniff: true,
    referrerPolicy: { policy: 'no-referrer' as const },
    hsts: hstsEnabled
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  },
  bodyLimit: process.env.SECURITY_BODY_LIMIT ?? '1mb',
  compression: {
    threshold: process.env.SECURITY_COMPRESSION_THRESHOLD ?? '1kb',
  },
  trustProxy: process.env.SECURITY_TRUST_PROXY?.trim() || false,
  grpc: {
    maxMessageBytes: Number(
      process.env.SECURITY_GRPC_MAX_MESSAGE_BYTES ?? 1048576,
    ),
  },
}));
