import { execFileSync } from 'node:child_process';
import { loadEnvFile } from 'node:process';

const PRISMA_COMMAND = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';
const TEST_DATABASE_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

function loadProjectEnvironment(): void {
  try {
    loadEnvFile('.env');
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !('code' in error) ||
      error.code !== 'ENOENT'
    ) {
      throw error;
    }
  }
}

function synchronizeDatabaseEnvironment(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required for integration/E2E tests; refusing to run against an undefined database.',
    );
  }

  const url = new URL(databaseUrl);
  if (url.protocol !== 'mysql:') {
    throw new Error(
      `Integration/E2E tests require a MariaDB/MySQL DATABASE_URL, received ${url.protocol}`,
    );
  }

  const hostname = url.hostname;
  if (!TEST_DATABASE_HOSTS.has(hostname)) {
    throw new Error(
      `Refusing to mutate non-local database host "${hostname}" during tests. Use a local test database.`,
    );
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!databaseName || !databaseName.toLowerCase().includes('test')) {
    throw new Error(
      `Refusing to provision database "${databaseName}". The database name must identify a test database.`,
    );
  }

  process.env.DATABASE_HOST = hostname;
  process.env.DATABASE_PORT = url.port || '3306';
  process.env.DATABASE_NAME = databaseName;
  process.env.DATABASE_USER = decodeURIComponent(url.username);
  process.env.DATABASE_PASSWORD = decodeURIComponent(url.password);
}

export function prepareTestDatabase(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      `Database test setup may only run with NODE_ENV=test, received "${process.env.NODE_ENV ?? 'undefined'}".`,
    );
  }

  loadProjectEnvironment();
  synchronizeDatabaseEnvironment();

  execFileSync(PRISMA_COMMAND, ['db', 'push', '--accept-data-loss'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });
}

prepareTestDatabase();
