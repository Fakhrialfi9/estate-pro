import type { SeedTransaction } from './database.ts';

type ColumnRow = {
  tableName: string;
  columnName: string;
  dataType: string;
  columnType: string;
};

type ValueRow = { value: string | null };

const EXCLUDED_TABLES = new Set([
  'authentication_user_sessions',
  'authentication_refresh_token_families',
  'authentication_refresh_tokens',
  'authentication_password_reset_tokens',
  'authentication_user_two_factor_challenges',
  'authentication_user_two_factor_recovery_codes',
  'authentication_user_credentials',
  'authentication_user_security',
  'system_integration_credentials',
]);

const INCLUDED_PREFIXES = [
  'authorization_',
  'agent_',
  'property_',
  'crm_',
  'sales_',
  'matching_',
  'match_',
  'recommendation',
  'content_',
  'automation_',
  'system_',
  'audit_',
] as const;

function quoteIdentifier(value: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
  return `\`${value}\``;
}

function included(tableName: string): boolean {
  return !EXCLUDED_TABLES.has(tableName) && INCLUDED_PREFIXES.some((prefix) => tableName.startsWith(prefix));
}

function looksGenerated(value: string): boolean {
  return value.startsWith('seed-') || value.startsWith('Seed ') || /-\d+$/.test(value);
}

export async function sanitizeSemanticCoverage(tx: SeedTransaction): Promise<void> {
  const columns = await tx.$queryRawUnsafe<ColumnRow[]>(
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, DATA_TYPE AS dataType, COLUMN_TYPE AS columnType FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION`,
  );

  for (const column of columns.filter(({ tableName }) => included(tableName))) {
    const table = quoteIdentifier(column.tableName);
    const field = quoteIdentifier(column.columnName);

    if (column.columnName === 'currency' && column.columnType.toLowerCase().includes('char')) {
      await tx.$executeRawUnsafe(
        `UPDATE ${table} SET ${field} = 'IDR' WHERE ${field} LIKE 'seed-%' OR ${field} REGEXP '-[0-9]+$'`,
      );
      continue;
    }

    if (column.columnName === 'country_code' && column.columnType.toLowerCase().includes('char')) {
      await tx.$executeRawUnsafe(
        `UPDATE ${table} SET ${field} = 'ID' WHERE ${field} LIKE 'seed-%' OR ${field} REGEXP '-[0-9]+$'`,
      );
      continue;
    }

    if (column.columnName === 'timezone' && ['char', 'varchar'].includes(column.dataType)) {
      await tx.$executeRawUnsafe(
        `UPDATE ${table} SET ${field} = 'Asia/Jakarta' WHERE ${field} LIKE 'seed-%' OR ${field} REGEXP '-[0-9]+$'`,
      );
      continue;
    }

    if (column.columnType.toLowerCase() === 'tinyint(1)') {
      await tx.$executeRawUnsafe(`UPDATE ${table} SET ${field} = 1 WHERE ${field} > 1`);
      continue;
    }

    if (!['status', 'state', 'channel', 'direction', 'priority', 'type'].includes(column.columnName)) continue;

    const values = await tx.$queryRawUnsafe<ValueRow[]>(
      `SELECT DISTINCT ${field} AS value FROM ${table} WHERE ${field} IS NOT NULL ORDER BY ${field}`,
    );
    const validValues = values
      .map(({ value }) => value)
      .filter((value): value is string => typeof value === 'string' && !looksGenerated(value));
    if (validValues.length === 0) continue;

    for (let index = 0; index < validValues.length; index += 1) {
      const value = validValues[index];
      await tx.$executeRawUnsafe(
        `UPDATE ${table} SET ${field} = ? WHERE (${field} LIKE 'seed-%' OR ${field} REGEXP '-[0-9]+$' OR ${field} LIKE 'Seed %') AND MOD(CRC32(CAST(${field} AS CHAR)), ?) = ?`,
        value,
        validValues.length,
        index,
      );
    }
  }
}
