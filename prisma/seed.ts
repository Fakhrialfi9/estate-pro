import 'dotenv/config';

import { assertDatabaseSchemaMatchesMigrations } from './seeds/preflight.ts';
import { seedDatabase } from './seeds/runner.ts';

assertDatabaseSchemaMatchesMigrations();
await seedDatabase();
