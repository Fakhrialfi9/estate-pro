import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PRISMA_COMMAND = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';
const TEST_DATABASE_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const TEST_DATABASE_NAME_PATTERN = /test/i;

function readProjectDatabaseUrl(): string | undefined {
  try {
    const envFile = readFileSync('.env', 'utf8');
    const match = envFile.match(/^\s*DATABASE_URL\s*=\s*(.*?)\s*$/m);

    if (!match?.[1]) {
      return undefined;
    }

    return match[1].replace(/^['"]|['"]$/g, '');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }

    throw error;
  }
}

function isSafeTestDatabaseUrl(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) {
    return false;
  }

  try {
    const url = new URL(databaseUrl);
    const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));

    return (
      url.protocol === 'mysql:' &&
      TEST_DATABASE_HOSTS.has(url.hostname) &&
      TEST_DATABASE_NAME_PATTERN.test(databaseName)
    );
  } catch {
    return false;
  }
}

function resolveTestDatabaseUrl(): string {
  const processDatabaseUrl = process.env.DATABASE_URL;

  if (isSafeTestDatabaseUrl(processDatabaseUrl)) {
    return processDatabaseUrl!;
  }

  const projectDatabaseUrl = readProjectDatabaseUrl();

  if (isSafeTestDatabaseUrl(projectDatabaseUrl)) {
    return projectDatabaseUrl!;
  }

  if (processDatabaseUrl) {
    throw new Error(
      `Refusing to provision database from DATABASE_URL. Expected a local MySQL/MariaDB test database, received "${processDatabaseUrl}".`,
    );
  }

  throw new Error(
    'DATABASE_URL is required for integration/E2E tests. Configure a local MySQL/MariaDB test database such as estate_pro_test.',
  );
}

function synchronizeDatabaseEnvironment(databaseUrl: string): void {
  const url = new URL(databaseUrl);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));

  process.env.DATABASE_URL = databaseUrl;
  process.env.DATABASE_HOST = url.hostname;
  process.env.DATABASE_PORT = url.port || '3306';
  process.env.DATABASE_NAME = databaseName;
  process.env.DATABASE_USER = decodeURIComponent(url.username);
  process.env.DATABASE_PASSWORD = decodeURIComponent(url.password);
}

export function prepareTestDatabase(): void {
  process.env.NODE_ENV ??= 'test';

  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      `Database test setup may only run with NODE_ENV=test, received "${process.env.NODE_ENV}".`,
    );
  }

  const databaseUrl = resolveTestDatabaseUrl();
  synchronizeDatabaseEnvironment(databaseUrl);

  execFileSync(PRISMA_COMMAND, ['db', 'push', '--accept-data-loss'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });
}
