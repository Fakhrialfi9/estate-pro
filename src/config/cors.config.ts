import { registerAs } from '@nestjs/config';

const parseOrigins = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

export default registerAs('cors', () => ({
  origins: parseOrigins(process.env.SECURITY_CORS_ORIGINS),
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin'],
  exposedHeaders: [],
  credentials: true,
  maxAge: 86400,
}));
