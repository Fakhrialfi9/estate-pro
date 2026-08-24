import 'dotenv/config';

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema',

  migrations: {
    path: 'prisma/schema/migrations',
  },

  datasource: {
    // Prisma CLI commands such as `generate` do not require a database
    // connection. Keep the URL optional here so generation/type-checking can
    // run in CI without application runtime secrets; database commands still
    // require DATABASE_URL to be supplied by the environment.
    url: process.env.DATABASE_URL ?? '',
  },
});
