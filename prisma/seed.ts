import 'dotenv/config';

import { seedDatabase } from './seeds/runner.ts';

await seedDatabase();
