import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PRISMA_COMMAND = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';
const TEST_DATABASE_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const TEST_DATABASE_NAME_PATTERN = /test/i;
const DEFAULT_TEST_DATABASE_NAME = 'estate_pro_test';

type Environment = Record<string, string | undefined>;

function readProjectEnvironment(): Environment {
  try {
    const content = readFileSync('.env', 'utf8');
    const environment: Environment = {};

    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match) {
        continue;
      }

      const key = match[1];
      const value = match[2];
      environment[key] = value.replace(/^['"]|['"]$/g, '');
    }

    return environment;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return {};
    }

    throw error;
  }
}

function parseDatabaseUrl(databaseUrl: string | undefined): URL | undefined {
  if (!databaseUrl) {
    return undefined;
  }

  try {
    return new URL(databaseUrl);
  } catch {
    return undefined;
  }
}

function getDatabaseName(databaseUrl: URL): string {
  return decodeURIComponent(databaseUrl.pathname.replace(/^\//, ''));
}

function getSafeTestDatabaseUrl(
  databaseUrl: string | undefined,
): string | undefined {
  const url = parseDatabaseUrl(databaseUrl);
  if (!url) {
    return undefined;
  }

  if (url.protocol !== 'mysql:' || !TEST_DATABASE_HOSTS.has(url.hostname)) {
    return undefined;
  }

  const databaseName = getDatabaseName(url);
  if (!databaseName) {
    return undefined;
  }

  if (TEST_DATABASE_NAME_PATTERN.test(databaseName)) {
    return databaseUrl;
  }

  const testDatabaseUrl = new URL(url.toString());
  testDatabaseUrl.pathname = `/${encodeURIComponent(`${databaseName}_test`)}`;
  return testDatabaseUrl.toString();
}

function buildDatabaseUrl(environment: Environment): string | undefined {
  const host = environment.DATABASE_HOST;
  const port = environment.DATABASE_PORT ?? '3306';
  const user = environment.DATABASE_USER;
  const password = environment.DATABASE_PASSWORD;
  const configuredName = environment.DATABASE_NAME;

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
  const processEnvironment: Environment = process.env;
  const processDatabaseUrl = processEnvironment.DATABASE_URL;
  const projectDatabaseUrl = projectEnvironment.DATABASE_URL;

  const safeProcessDatabaseUrl = getSafeTestDatabaseUrl(processDatabaseUrl);
  if (safeProcessDatabaseUrl) {
    return safeProcessDatabaseUrl;
  }

  const safeProjectDatabaseUrl = getSafeTestDatabaseUrl(projectDatabaseUrl);
  if (safeProjectDatabaseUrl) {
    return safeProjectDatabaseUrl;
  }

  const processDatabaseFromParts = buildDatabaseUrl(processEnvironment);
  const safeProcessDatabaseFromParts = getSafeTestDatabaseUrl(
    processDatabaseFromParts,
  );
  if (safeProcessDatabaseFromParts) {
    return safeProcessDatabaseFromParts;
  }

  const projectDatabaseFromParts = buildDatabaseUrl(projectEnvironment);
  const safeProjectDatabaseFromParts = getSafeTestDatabaseUrl(
    projectDatabaseFromParts,
  );
  if (safeProjectDatabaseFromParts) {
    return safeProjectDatabaseFromParts;
  }

  const unsafeDatabaseUrl = processDatabaseUrl ?? projectDatabaseUrl;
  if (unsafeDatabaseUrl) {
    throw new Error(
      `Refusing to provision database from DATABASE_URL. Expected a local MySQL/MariaDB database target, received "${unsafeDatabaseUrl}".`,
    );
  }

  throw new Error(
    'Unable to resolve a local test database. Configure DATABASE_URL or DATABASE_HOST/DATABASE_PORT/DATABASE_NAME/DATABASE_USER/DATABASE_PASSWORD for a local MySQL/MariaDB database.',
  );
}

function synchronizeDatabaseEnvironment(databaseUrl: string): void {
  const url = parseDatabaseUrl(databaseUrl);
  if (!url) {
    throw new Error('Resolved test database URL is invalid.');
  }

  process.env.DATABASE_URL = databaseUrl;
  process.env.DATABASE_HOST = url.hostname;
  process.env.DATABASE_PORT = url.port || '3306';
  process.env.DATABASE_NAME = getDatabaseName(url);
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

  // Prisma ORM 7 does not support --skip-seed on migrate reset. Seed execution
  // is handled explicitly by the test workflow after the schema reset.
  execFileSync(PRISMA_COMMAND, ['migrate', 'reset', '--force'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });
}
