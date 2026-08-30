import { afterEach, describe, expect, it } from 'vitest';
import databaseConfig from '../../../src/config/database.config.js';

describe('canonical database configuration', () => {
  afterEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_HOST;
    delete process.env.DATABASE_PORT;
    delete process.env.DATABASE_NAME;
    delete process.env.DATABASE_USER;
    delete process.env.DATABASE_PASSWORD;
  });

  it('derives every database target field from DATABASE_URL', () => {
    process.env.DATABASE_URL =
      'mysql://canonical-user:canonical-password@canonical-db.example:3307/canonical_database';
    process.env.DATABASE_HOST = 'attacker-db.example';
    process.env.DATABASE_PORT = '3309';
    process.env.DATABASE_NAME = 'attacker_database';
    process.env.DATABASE_USER = 'attacker-user';
    process.env.DATABASE_PASSWORD = 'attacker-password';

    const config = databaseConfig();

    expect(config.url).toBe(process.env.DATABASE_URL);
    expect(config.host).toBe('canonical-db.example');
    expect(config.port).toBe(3307);
    expect(config.name).toBe('canonical_database');
    expect(config.username).toBe('canonical-user');
    expect(config.password).toBe('canonical-password');
  });

  it('fails closed on a non-MySQL canonical URL', () => {
    process.env.DATABASE_URL = 'postgresql://user:password@db.example:5432/app';

    expect(() => databaseConfig()).toThrowError(
      'DATABASE_URL must use the mysql scheme',
    );
  });
});
