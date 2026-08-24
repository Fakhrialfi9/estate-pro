import { registerAs } from '@nestjs/config';

export default registerAs('security', () => ({
  helmet: {
    enabled: true,
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
    frameguard: 'deny',
    noSniff: true,
    referrerPolicy: 'no-referrer',
    hsts: {
      enabled: process.env.NODE_ENV === 'production',
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  },
  bodyLimit: process.env.SECURITY_BODY_LIMIT ?? '1mb',
  trustProxy: process.env.SECURITY_TRUST_PROXY,
  grpc: {
    maxMessageBytes: Number(
      process.env.SECURITY_GRPC_MAX_MESSAGE_BYTES ?? 1048576,
    ),
  },
}));
