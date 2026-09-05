import 'dotenv/config';

import { assertDatabaseSchemaMatchesSchema } from './seeds/preflight.ts';
import { seedDatabase } from './seeds/runner.ts';

assertDatabaseSchemaMatchesSchema();
await seedDatabase();
