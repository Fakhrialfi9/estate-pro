import { prepareTestDatabase } from '../database/setup.js';

process.env.NODE_ENV = 'test';

prepareTestDatabase();
