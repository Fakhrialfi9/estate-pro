import { registerAs } from '@nestjs/config';

import { parseCanonicalDatabaseUrl } from './database-url.js';

export default registerAs('database', () => {
  const canonical = parseCanonicalDatabaseUrl(process.env.DATABASE_URL);

  return {
    url: canonical?.url,
    host: canonical?.host,
    port: canonical?.port,
    name: canonical?.database,
    username: canonical?.username,
    password: canonical?.password,
    pool: {
      connectionLimit: Number(process.env.DATABASE_POOL_CONNECTION_LIMIT ?? 10),
      connectTimeoutMs: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS ?? 5000),
      acquireTimeoutMs: Number(
        process.env.DATABASE_ACQUIRE_TIMEOUT_MS ?? 10000,
      ),
      idleTimeoutSec: Number(process.env.DATABASE_POOL_IDLE_TIMEOUT_SEC ?? 300),
    },
  };
});
