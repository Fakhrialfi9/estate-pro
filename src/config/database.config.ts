import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 3306),
  name: process.env.DATABASE_NAME ?? 'estate_pro',
  username: process.env.DATABASE_USER ?? '',
  password: process.env.DATABASE_PASSWORD ?? '',
  pool: {
    connectionLimit: Number(process.env.DATABASE_POOL_CONNECTION_LIMIT ?? 10),
    connectTimeoutMs: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS ?? 5000),
    acquireTimeoutMs: Number(process.env.DATABASE_ACQUIRE_TIMEOUT_MS ?? 10000),
    idleTimeoutSec: Number(process.env.DATABASE_POOL_IDLE_TIMEOUT_SEC ?? 300),
  },
}));
