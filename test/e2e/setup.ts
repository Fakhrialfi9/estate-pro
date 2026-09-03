import { prepareTestDatabase } from '../database/setup.js';
import { configureTestEnvironment } from './environment.js';

export function setup(): void {
  configureTestEnvironment();
  prepareTestDatabase();
}
