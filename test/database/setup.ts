import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PRISMA_COMMAND = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';
const TEST_DATABASE_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const TEST_DATABASE_NAME_PATTERN = /test/i;
const DEFAULT_TEST_DATABASE_NAME = 'estate_pro_test';

type Environment = Record<string, string>;

function readProjectEnvironment(): Environment {
  try {
    const content = readFileSync('.env', 'utf8');
    const environment: Environment = {};

    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match) {
        continue;
      }

      environment[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }

    return environment;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return {};
    }

    throw error;
  }
}

function isLocalMysqlDatabaseUrl(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) {
    return false;
  }

  try {
    const url = new URL(databaseUrl);
    return url.protocol === 'mysql:' && TEST_DATABASE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function getDatabaseName(databaseUrl: string): string {
  return decodeURIComponent(databaseUrl.pathname.replace(/^\//, ''));
}

function isSafeTestDatabaseUrl(databaseUrl: string | undefined): boolean {
  return (
    isLocalMysqlDatabaseUrl(databaseUrl) &&
    TEST_DATABASE_NAME_PATTERN.test(getDatabaseName(databaseUrl!))
  );
}

function buildDatabaseUrl(environment: Environment): string | undefined {
  const host = environment.DATABASE_HOST ?? process.env.DATABASE_HOST;
  const port = environment.DATABASE_PORT ?? process.env.DATABASE_PORT ?? '3306';
  const user = environment.DATABASE_USER ?? process.env.DATABASE_USER;
  const password =
    environment.DATABASE_PASSWORD ?? process.env.DATABASE_PASSWORD;
  const configuredName = environment.DATABASE_NAME ?? process.env.DATABASE_NAME;

  if (!host || !user || password === undefined) {
    return undefined;
  }

  const databaseName =
    configuredName && TEST_DATABASE_NAME_PATTERN.test(configuredName)
      ? configuredName
      : DEFAULT_TEST_DATABASE_NAME;

  const url = new URL(
    `mysql://${encodeURIComponent(user)}@${host}:${port}/${encodeURIComponent(databaseName)}`,
  );
  url.password = password;
  return url.toString();
}

function resolveTestDatabaseUrl(): string {
  const projectEnvironment = readProjectEnvironment();
  const processDatabaseUrl = process.env.DATABASE_URL;
  const projectDatabaseUrl = projectEnvironment.DATABASE_URL;

  if (isSafeTestDatabaseUrl(processDatabaseUrl)) {
    return processDatabaseUrl!;
  }

  if (isSafeTestDatabaseUrl(projectDatabaseUrl)) {
    return projectDatabaseUrl!;
  }

  const processDatabaseFromParts = buildDatabaseUrl(process.env as Environment);
  if (isSafeTestDatabaseUrl(processDatabaseFromParts)) {
    return processDatabaseFromParts!;
  }

  const projectDatabaseFromParts = buildDatabaseUrl(projectEnvironment);
  if (isSafeTestDatabaseUrl(projectDatabaseFromParts)) {
    return projectDatabaseFromParts!;
  }

  const unsafeDatabaseUrl = processDatabaseUrl ?? projectDatabaseUrl;
  if (unsafeDatabaseUrl) {
    throw new Error(
      `Refusing to provision database from DATABASE_URL. Expected a local MySQL/MariaDB test database, received "${unsafeDatabaseUrl}".`,
    );
  }

  throw new Error(
    'Unable to resolve a local test database. Configure DATABASE_URL or DATABASE_HOST/DATABASE_PORT/DATABASE_NAME/DATABASE_USER/DATABASE_PASSWORD for a local MySQL/MariaDB database.',
  );
}

function synchronizeDatabaseEnvironment(databaseUrl: string): void {
  const url = new URL(databaseUrl);
  const databaseName = getDatabaseName(databaseUrl);

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
