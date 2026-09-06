import { createHash } from 'node:crypto';

import type { PrismaClient } from '../generated/prisma/client.ts';
import type { SeedTransaction } from './database.ts';
import { SEED_MIN_RECORDS } from './config.ts';
import { SEEDED_BASELINE_TABLES } from './verification.ts';

type InformationSchemaColumn = {
  TABLE_NAME: string;
  COLUMN_NAME: string;
  DATA_TYPE: string;
  CHARACTER_MAXIMUM_LENGTH: number | bigint | null;
  IS_NULLABLE: 'YES' | 'NO';
  EXTRA: string;
};

type InformationSchemaIndex = {
  TABLE_NAME: string;
  INDEX_NAME: string;
  COLUMN_NAME: string;
  SEQ_IN_INDEX: number | bigint;
  NON_UNIQUE: 0 | 1 | bigint;
};

type InformationSchemaForeignKey = {
  TABLE_NAME: string;
  COLUMN_NAME: string;
  REFERENCED_TABLE_NAME: string;
  REFERENCED_COLUMN_NAME: string;
};

type TableMeta = {
  tableName: string;
  columns: InformationSchemaColumn[];
  primaryKeys: string[];
  autoIncrementPrimaryKey: string | null;
  uniqueIndexes: string[][];
  foreignKeys: Map<string, InformationSchemaForeignKey>;
};

type RuntimeModel = {
  dbName?: string | null;
};

type RuntimeDataModel = {
  models: Record<string, RuntimeModel>;
};

type PrismaWithRuntimeDataModel = PrismaClient & {
  _runtimeDataModel?: RuntimeDataModel;
};

type RawRow = Record<string, unknown>;

function deterministicUuid(namespace: string, value: string): string {
  const digest = createHash('sha256').update(`${namespace}:${value}`).digest('hex');
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

function quoteIdentifier(value: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
  return `\`${value}\``;
}

function isStringType(dataType: string): boolean {
  return ['char', 'varchar', 'text', 'tinytext', 'mediumtext', 'longtext'].includes(dataType.toLowerCase());
}

function isJsonType(dataType: string): boolean {
  return dataType.toLowerCase() === 'json';
}

function asComparableKey(value: unknown): string {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Uint8Array) return Buffer.from(value).toString('hex');
  return String(value);
}

function isUuidLike(column: InformationSchemaColumn, value: string): boolean {
  return column.CHARACTER_MAXIMUM_LENGTH === 36 || /(^|_)(uuid|id)$/i.test(column.COLUMN_NAME) && value.length === 36;
}

function varyString(column: InformationSchemaColumn, value: string, variant: number, tableName: string): string {
  if (isUuidLike(column, value)) return deterministicUuid(tableName, `${column.COLUMN_NAME}:${value}:${variant}`);

  const maxLength = column.CHARACTER_MAXIMUM_LENGTH === null ? Number.MAX_SAFE_INTEGER : Number(column.CHARACTER_MAXIMUM_LENGTH);
  if (!Number.isSafeInteger(maxLength) || maxLength < 1) {
    throw new Error(`Invalid string length metadata for ${tableName}.${column.COLUMN_NAME}`);
  }

  if (value.includes('@')) {
    const at = value.indexOf('@');
    const local = value.slice(0, at);
    const domain = value.slice(at + 1);
    const candidate = `${local}+seed${variant}@${domain}`;
    return candidate.slice(0, maxLength);
  }

  const suffix = `-seed-${variant}`;
  if (value.length + suffix.length <= maxLength) return `${value}${suffix}`;
  return `${value.slice(0, Math.max(1, maxLength - suffix.length))}${suffix}`.slice(0, maxLength);
}

function varyScalar(column: InformationSchemaColumn, value: unknown, variant: number, tableName: string): unknown {
  if (value === null || value === undefined) return value;

  if (isStringType(column.DATA_TYPE)) return varyString(column, String(value), variant, tableName);

  switch (column.DATA_TYPE.toLowerCase()) {
    case 'tinyint':
    case 'smallint':
    case 'mediumint':
    case 'int':
    case 'bigint':
      return typeof value === 'bigint' ? value + BigInt(variant) : Number(value) + variant;
    case 'decimal':
    case 'numeric':
    case 'float':
    case 'double':
      return Number(value) + variant;
    case 'date':
    case 'datetime':
    case 'timestamp':
      return value instanceof Date ? new Date(value.getTime() + variant * 1000) : value;
    default:
      return value;
  }
}

function resolveRuntimeModel(runtimeModels: Record<string, RuntimeModel>, delegateName: string): RuntimeModel | undefined {
  const direct = runtimeModels[delegateName];
  if (direct) return direct;

  const modelName = delegateName.charAt(0).toUpperCase() + delegateName.slice(1);
  return runtimeModels[modelName];
}

async function loadTableMetadata(tx: SeedTransaction, prisma: PrismaClient): Promise<Map<string, TableMeta>> {
  const runtimeModels = (prisma as PrismaWithRuntimeDataModel)._runtimeDataModel?.models;
  if (!runtimeModels) throw new Error('Unable to inspect Prisma runtime model metadata');

  const modelToTable = new Map<string, string>();
  for (const delegateName of SEEDED_BASELINE_TABLES) {
    const runtimeModel = resolveRuntimeModel(runtimeModels, delegateName);
    const tableName = runtimeModel?.dbName;
    if (!tableName) throw new Error(`Missing database table mapping for Prisma model delegate ${delegateName}`);
    modelToTable.set(delegateName, tableName);
  }

  const schema = await tx.$queryRawUnsafe<{ tableName: string }[]>('SELECT DATABASE() AS tableName');
  const databaseName = schema[0]?.tableName;
  if (!databaseName) throw new Error('Unable to resolve active database name for seed expansion');

  const columns = await tx.$queryRawUnsafe<InformationSchemaColumn[]>(
    `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, EXTRA\n` +
      `FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE()`,
  );
  const indexes = await tx.$queryRawUnsafe<InformationSchemaIndex[]>(
    `SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE\n` +
      `FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
  );
  const foreignKeys = await tx.$queryRawUnsafe<InformationSchemaForeignKey[]>(
    `SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME\n` +
      `FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE\n` +
      `WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL`,
  );

  const result = new Map<string, TableMeta>();
  for (const delegateName of SEEDED_BASELINE_TABLES) {
    const tableName = modelToTable.get(delegateName)!;
    const tableColumns = columns.filter((column) => column.TABLE_NAME === tableName);
    const tableIndexes = indexes.filter((index) => index.TABLE_NAME === tableName);
    const primaryIndex = tableIndexes.filter((index) => index.INDEX_NAME === 'PRIMARY');
    if (primaryIndex.length === 0) throw new Error(`Seed expansion requires a primary key: ${tableName}`);

    const primaryKeys = primaryIndex
      .sort((left, right) => Number(left.SEQ_IN_INDEX) - Number(right.SEQ_IN_INDEX))
      .map((index) => index.COLUMN_NAME);
    const autoIncrementPrimaryKey =
      primaryKeys.length === 1 &&
      tableColumns.some((column) => column.COLUMN_NAME === primaryKeys[0] && column.EXTRA.includes('auto_increment'))
        ? primaryKeys[0]
        : null;

    const uniqueIndexes = Array.from(
      tableIndexes
        .filter((index) => index.NON_UNIQUE === 0 || index.NON_UNIQUE === BigInt(0))
        .filter((index) => index.INDEX_NAME !== 'PRIMARY')
        .reduce((groups, index) => {
          const columnsForIndex = groups.get(index.INDEX_NAME) ?? [];
          columnsForIndex[Number(index.SEQ_IN_INDEX) - 1] = index.COLUMN_NAME;
          groups.set(index.INDEX_NAME, columnsForIndex);
          return groups;
        }, new Map<string, string[]>()),
    ).map(([, uniqueColumns]) => uniqueColumns);

    result.set(delegateName, {
      tableName,
      columns: tableColumns,
      primaryKeys,
      autoIncrementPrimaryKey,
      uniqueIndexes,
      foreignKeys: new Map(
        foreignKeys
          .filter((foreignKey) => foreignKey.TABLE_NAME === tableName)
          .map((foreignKey) => [foreignKey.COLUMN_NAME, foreignKey]),
      ),
    });
  }

  void databaseName;
  return result;
}

function serializeValue(column: InformationSchemaColumn, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (isJsonType(column.DATA_TYPE) && typeof value !== 'string') return JSON.stringify(value);
  return value;
}

function varyPrimaryKeyColumns(
  source: RawRow,
  row: RawRow,
  meta: TableMeta,
  fkValues: Map<string, InformationSchemaForeignKey>,
  tableRows: Map<string, RawRow[]>,
  variant: number,
): void {
  for (const primaryKey of meta.primaryKeys) {
    const foreignKey = fkValues.get(primaryKey);
    if (foreignKey) {
      const parentRows = tableRows.get(foreignKey.REFERENCED_TABLE_NAME);
      if (parentRows && parentRows.length > 0) {
        const parentRow = parentRows[(variant - 1) % parentRows.length];
        row[primaryKey] = parentRow[foreignKey.REFERENCED_COLUMN_NAME];
        continue;
      }
    }

    const column = meta.columns.find((item) => item.COLUMN_NAME === primaryKey);
    if (!column) continue;
    row[primaryKey] = varyScalar(column, source[primaryKey], variant, meta.tableName);
  }
}

function buildUniqueKey(row: RawRow, columns: string[]): string | null {
  const values = columns.map((columnName) => row[columnName]);
  if (values.some((value) => value === null || value === undefined)) return null;
  return values.map(asComparableKey).join('\u001f');
}

function addOccupiedUniqueKeys(
  occupiedKeys: Map<string, Set<string>>,
  row: RawRow,
  indexes: string[][],
): void {
  for (const columns of indexes) {
    const key = buildUniqueKey(row, columns);
    if (!key) continue;
    const indexKey = columns.join('\u001f');
    const keys = occupiedKeys.get(indexKey) ?? new Set<string>();
    keys.add(key);
    occupiedKeys.set(indexKey, keys);
  }
}

function ensureUniqueIndexes(
  row: RawRow,
  meta: TableMeta,
  source: RawRow,
  tableRows: Map<string, RawRow[]>,
  occupiedKeys: Map<string, Set<string>>,
  variant: number,
): void {
  const indexes = meta.primaryKeys.length > 1 ? [meta.primaryKeys, ...meta.uniqueIndexes] : meta.uniqueIndexes;

  for (const uniqueIndex of indexes) {
    const indexKey = uniqueIndex.join('\u001f');
    const keys = occupiedKeys.get(indexKey) ?? new Set<string>();
    const currentKey = buildUniqueKey(row, uniqueIndex);
    if (!currentKey || !keys.has(currentKey)) continue;

    let resolved = false;
    for (let attempt = 0; attempt < SEED_MIN_RECORDS * 4 && !resolved; attempt += 1) {
      for (const columnName of uniqueIndex) {
        const column = meta.columns.find((item) => item.COLUMN_NAME === columnName);
        if (!column || row[columnName] === null || row[columnName] === undefined) continue;

        const foreignKey = meta.foreignKeys.get(columnName);
        if (foreignKey) {
          const parentRows = tableRows.get(foreignKey.REFERENCED_TABLE_NAME);
          if (!parentRows || parentRows.length === 0) continue;
          const parentRow = parentRows[(variant + attempt) % parentRows.length];
          row[columnName] = parentRow[foreignKey.REFERENCED_COLUMN_NAME];
        } else {
          row[columnName] = varyScalar(column, source[columnName], variant + attempt + 1, meta.tableName);
        }

        const candidateKey = buildUniqueKey(row, uniqueIndex);
        if (!candidateKey || !keys.has(candidateKey)) {
          resolved = true;
          break;
        }
      }
    }

    if (!resolved) {
      const key = buildUniqueKey(row, uniqueIndex);
      throw new Error(
        `Unable to generate a unique seed row for ${meta.tableName} on index (${uniqueIndex.join(', ')})` +
          (key ? `; conflicting key ${key}` : ''),
      );
    }
  }

  addOccupiedUniqueKeys(occupiedKeys, row, indexes);
}

async function expandModel(
  tx: SeedTransaction,
  meta: TableMeta,
  tableRows: Map<string, RawRow[]>,
  clonePrimaryKeys: Map<string, Map<string, bigint>>,
): Promise<void> {
  const rows = await tx.$queryRawUnsafe<RawRow[]>(`SELECT * FROM ${quoteIdentifier(meta.tableName)}`);
  tableRows.set(meta.tableName, rows);

  if (rows.length === 0) throw new Error(`Seed expansion found no baseline records for ${meta.tableName}`);
  if (rows.length >= SEED_MIN_RECORDS) return;

  const rowsToCreate = SEED_MIN_RECORDS - rows.length;
  const sourceRows = rows.slice(0, rows.length);
  const insertColumns = meta.columns.filter((column) => !column.EXTRA.includes('auto_increment'));
  const fkValues = new Map<string, InformationSchemaForeignKey>();
  for (const [columnName, foreignKey] of meta.foreignKeys) fkValues.set(columnName, foreignKey);

  const occupiedKeys = new Map<string, Set<string>>();
  const trackedIndexes = meta.primaryKeys.length > 1 ? [meta.primaryKeys, ...meta.uniqueIndexes] : meta.uniqueIndexes;
  for (const existingRow of rows) addOccupiedUniqueKeys(occupiedKeys, existingRow, trackedIndexes);

  const newRows: RawRow[] = [];
  for (let variant = 1; variant <= rowsToCreate; variant += 1) {
    const source = sourceRows[(variant - 1) % sourceRows.length];
    const row: RawRow = { ...source };

    for (const [columnName, foreignKey] of fkValues) {
      const originalValue = source[columnName];
      if (originalValue === null || originalValue === undefined) continue;

      const parentMap = clonePrimaryKeys.get(foreignKey.REFERENCED_TABLE_NAME);
      const cloneKey = parentMap?.get(`${asComparableKey(originalValue)}:${variant}`);
      if (cloneKey !== undefined) {
        row[columnName] = cloneKey;
        continue;
      }

      const parentRows = tableRows.get(foreignKey.REFERENCED_TABLE_NAME);
      if (parentRows && parentRows.length >= SEED_MIN_RECORDS) {
        const parentRow = parentRows[(variant - 1) % parentRows.length];
        row[columnName] = parentRow[foreignKey.REFERENCED_COLUMN_NAME];
      }
    }

    if (meta.primaryKeys.length > 1) {
      varyPrimaryKeyColumns(source, row, meta, fkValues, tableRows, variant);
    }

    ensureUniqueIndexes(row, meta, source, tableRows, occupiedKeys, variant);
    newRows.push(row);
  }

  const columnNames = insertColumns.map((column) => column.COLUMN_NAME);
  const placeholders = newRows.map(() => `(${columnNames.map(() => '?').join(', ')})`).join(', ');
  const values = newRows.flatMap((row) => insertColumns.map((column) => serializeValue(column, row[column.COLUMN_NAME])));

  await tx.$executeRawUnsafe(
    `INSERT INTO ${quoteIdentifier(meta.tableName)} (${columnNames.map(quoteIdentifier).join(', ')}) VALUES ${placeholders}`,
    ...values,
  );

  if (meta.autoIncrementPrimaryKey) {
    const [identity] = await tx.$queryRawUnsafe<{ insertId: bigint }[]>('SELECT LAST_INSERT_ID() AS insertId');
    if (!identity?.insertId) throw new Error(`Unable to resolve generated primary keys for ${meta.tableName}`);

    const modelCloneMap = clonePrimaryKeys.get(meta.tableName) ?? new Map<string, bigint>();
    for (let index = 0; index < newRows.length; index += 1) {
      const source = sourceRows[index % sourceRows.length];
      const newPrimaryKey = identity.insertId + BigInt(index);
      modelCloneMap.set(`${asComparableKey(source[meta.autoIncrementPrimaryKey])}:${index + 1}`, newPrimaryKey);
    }
    clonePrimaryKeys.set(meta.tableName, modelCloneMap);
  }

  const refreshedRows = await tx.$queryRawUnsafe<RawRow[]>(`SELECT * FROM ${quoteIdentifier(meta.tableName)}`);
  tableRows.set(meta.tableName, refreshedRows);
}

export async function expandSeedDataset(prisma: PrismaClient, tx: SeedTransaction): Promise<void> {
  const metadata = await loadTableMetadata(tx, prisma);
  const tableRows = new Map<string, RawRow[]>();
  const clonePrimaryKeys = new Map<string, Map<string, bigint>>();

  for (const modelName of SEEDED_BASELINE_TABLES) {
    const meta = metadata.get(modelName);
    if (!meta) throw new Error(`Missing metadata for ${modelName}`);
    await expandModel(tx, meta, tableRows, clonePrimaryKeys);
  }
}

export async function verifyExpandedSeedState(prisma: PrismaClient): Promise<void> {
  const modelDelegates = SEEDED_BASELINE_TABLES.map((modelName) => {
    const delegate = (prisma as unknown as Record<string, { count: () => Promise<number> }>)[modelName];
    if (!delegate) throw new Error(`Missing Prisma delegate for ${modelName}`);
    return { modelName, delegate };
  });

  const counts = await Promise.all(modelDelegates.map(async ({ modelName, delegate }) => ({ modelName, count: await delegate.count() })));
  const underMinimum = counts.filter(({ count }) => count < SEED_MIN_RECORDS);
  if (underMinimum.length > 0) {
    throw new Error(`Expanded seed verification failed: ${underMinimum.map(({ modelName, count }) => `${modelName}: expected >= ${SEED_MIN_RECORDS}, got ${count}`).join('; ')}`);
  }
}
