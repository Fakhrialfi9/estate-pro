export interface CanonicalDatabaseConfig {
  readonly url: string;
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly username: string;
  readonly password: string;
}

export const parseCanonicalDatabaseUrl = (
  value: string | undefined,
): CanonicalDatabaseConfig | undefined => {
  if (!value?.trim()) return undefined;

  const parsed = new URL(value);
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'mysql:') {
    throw new Error('DATABASE_URL must use the mysql scheme');
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!parsed.hostname || !database) {
    throw new Error('DATABASE_URL must include a host and database name');
  }

  return {
    url: value,
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    database,
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
};
