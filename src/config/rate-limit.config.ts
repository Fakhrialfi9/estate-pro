import { registerAs } from '@nestjs/config';

export default registerAs('rateLimit', () => ({
  ttl: Number(process.env.SECURITY_RATE_LIMIT_TTL ?? 60000),
  limit: Number(process.env.SECURITY_RATE_LIMIT_MAX ?? 100),
}));
