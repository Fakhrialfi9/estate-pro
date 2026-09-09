import type { SeedTransaction } from './database.ts';
import { SEED_MIN_RECORDS } from './config.ts';
import { seedUuid, SEED_REFERENCE_DATE } from './shared/ids.ts';

type ColumnMeta = {
  tableName: string;
  columnName: string;
  dataType: string;
  columnType: string;
  characterMaxLength: number | null;
  isNullable: boolean;
  columnDefault: string | null;
  extra: string;
};

type ForeignKeyMeta = {
  tableName: string;
  columnName: string;
  referencedTableName: string;
  referencedColumnName: string;
};

type MetadataNumber = bigint | number;
type MetadataBoolean = bigint | number | boolean;

type RawColumnMeta = Omit<ColumnMeta, 'characterMaxLength' | 'isNullable'> & {
  characterMaxLength: MetadataNumber | null;
  isNullable: MetadataBoolean;
};

type RawIndexMeta = {
  tableName: string;
  indexName: string;
  columnName: string;
  sequence: MetadataNumber;
  nonUnique: MetadataNumber;
};

type IndexMeta = {
  tableName: string;
  indexName: string;
  columnName: string;
  sequence: number;
  nonUnique: number;
};

type TableMeta = {
  tableName: string;
  columns: ColumnMeta[];
  primaryKeys: string[];
  uniqueIndexes: string[][];
  foreignKeys: Map<string, ForeignKeyMeta>;
};

type Row = Record<string, unknown>;

const EXCLUDED_TABLES = new Set([
  '_prisma_migrations',
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

const TARGET_OVERRIDES: Readonly<Record<string, number>> = {
  authorization_roles: 5,
  authorization_user_roles: 10,
  authorization_role_permissions: 10,
  agent_profiles: 10,
  properties: 20,
  crm_contacts: 20,
  crm_leads: 20,
  crm_inquiries: 10,
  crm_activities: 30,
  crm_communications: 20,
  sales_opportunities: 20,
  sales_viewings: 15,
  sales_negotiations: 10,
  sales_offers: 10,
  sales_deals: 10,
  sales_deal_items: 10,
  sales_closings: 10,
  sales_commissions: 10,
  property_preferences: 10,
  match_scores: 20,
  recommendations: 10,
  recommendation_items: 10,
  recommendation_histories: 10,
  match_feedback: 10,
  automation_workflows: 10,
  automation_workflow_versions: 10,
  automation_notifications: 20,
  automation_notification_deliveries: 20,
  automation_workflow_executions: 20,
  automation_action_executions: 20,
  content_articles: 10,
  content_pages: 10,
  content_banners: 10,
  content_faqs: 10,
  content_testimonials: 10,
  system_webhook_subscriptions: 10,
  system_webhook_deliveries: 20,
  system_import_jobs: 10,
  system_export_jobs: 10,
  system_activities: 50,
  audit_logs: 50,
};

const REFERENCE_TABLES = new Set([
  'property_types',
  'property_categories',
  'property_subcategories',
  'countries',
  'provinces',
  'cities',
  'districts',
  'subdistricts',
  'crm_lead_statuses',
  'crm_lead_status_transitions',
  'crm_lead_sources',
  'crm_lead_campaigns',
  'crm_lead_types',
  'crm_lead_tags',
  'crm_lead_score_rules',
  'sales_pipelines',
  'sales_pipeline_stages',
  'sales_lost_reasons',
  'sales_commission_rules',
]);

function quoteIdentifier(value: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }
  return `\`${value}\``;
}

function tableIncluded(tableName: string): boolean {
  if (EXCLUDED_TABLES.has(tableName)) return false;
  return INCLUDED_PREFIXES.some((prefix) => tableName.startsWith(prefix));
}

function targetFor(tableName: string): number {
  if (REFERENCE_TABLES.has(tableName)) return 1;
  return TARGET_OVERRIDES[tableName] ?? SEED_MIN_RECORDS;
}

function uuidValue(tableName: string, columnName: string, variant: number): string {
  return seedUuid(`semantic-${tableName}`, `${columnName}:${variant}`);
}

function parseEnumValues(columnType: string): string[] {
  if (!columnType.startsWith('enum(')) return [];
  return [...columnType.matchAll(/'((?:''|[^'])*)'/g)].map(([, value]) =>
    (value ?? '').replaceAll("''", "'"),
  );
}

function numericValue(columnName: string, variant: number): string | number {
  const name = columnName.toLowerCase();
  if (name.includes('percent') || name.includes('rate')) return (1 + (variant % 4) * 0.5).toFixed(4);
  if (name.includes('price') || name.includes('amount') || name.includes('value') || name.includes('revenue')) {
    return String(1_500_000_000 + variant * 125_000_000);
  }
  if (name.includes('score')) return 60 + (variant * 7) % 41;
  if (name.includes('quantity') || name.includes('count') || name.includes('attempt') || name.includes('version')) return (variant % 5) + 1;
  if (name.includes('duration') || name.includes('timeout')) return 30_000 + variant * 1_000;
  return variant;
}

function stringValue(
  column: ColumnMeta,
  source: unknown,
  variant: number,
  tableName: string,
): string {
  const name = column.columnName.toLowerCase();
  const existing = typeof source === 'string' ? source : '';
  const max = column.characterMaxLength ?? 255;

  if (name === 'uuid' || name.endsWith('_uuid')) return uuidValue(tableName, column.columnName, variant);
  if (name.includes('email')) return `seed.${tableName.replaceAll('_', '-')}.${variant}@example.test`;
  if (name.includes('phone')) return `+6281200${String(variant).padStart(6, '0')}`;
  if (name === 'slug') return `${tableName.replaceAll('_', '-')}-seed-${variant}`.slice(0, max);
  if (name.includes('idempotency') || name.includes('pairkey') || name.includes('pair_key')) return `seed-${tableName}-${variant}`.slice(0, max);
  if (name.includes('code')) return `${tableName.replaceAll('_', '-').slice(0, 40)}-${String(variant).padStart(3, '0')}`.slice(0, max);
  if (name.includes('title') || name === 'name' || name.endsWith('name')) return `Seed ${tableName.replaceAll('_', ' ')} ${variant}`.slice(0, max);
  if (name.includes('description') || name.includes('summary') || name.includes('message') || name.includes('body') || name.includes('notes')) {
    return `Deterministic development fixture ${variant} for ${tableName.replaceAll('_', ' ')}.`.slice(0, Math.max(1, max));
  }
  if (existing.length > 0) {
    const suffix = `-${variant}`;
    return `${existing.slice(0, Math.max(1, max - suffix.length))}${suffix}`.slice(0, max);
  }
  return `seed-${tableName}-${column.columnName}-${variant}`.slice(0, max);
}

function scalarValue(column: ColumnMeta, source: unknown, variant: number, tableName: string): unknown {
  if (source !== null && source !== undefined) {
    if (column.dataType === 'json' && typeof source !== 'string') {
      return JSON.stringify(source);
    }
    if (column.dataType === 'date' || column.dataType === 'datetime' || column.dataType === 'timestamp') {
      return source instanceof Date
        ? new Date(source.getTime() + variant * 86_400_000)
        : source;
    }
    if (['char', 'varchar', 'text', 'tinytext', 'mediumtext', 'longtext'].includes(column.dataType)) {
      return stringValue(column, source, variant, tableName);
    }
    if (['tinyint', 'smallint', 'mediumint', 'int', 'bigint', 'decimal', 'numeric', 'float', 'double'].includes(column.dataType)) {
      return numericValue(column.columnName, variant);
    }
    return source;
  }

  const enumValues = parseEnumValues(column.columnType);
  if (enumValues.length > 0) return enumValues[variant % enumValues.length];

  switch (column.dataType) {
    case 'json':
      return JSON.stringify({ seed: true, variant });
    case 'date':
      return new Date(SEED_REFERENCE_DATE.getTime() + variant * 86_400_000);
    case 'datetime':
    case 'timestamp':
      return new Date(SEED_REFERENCE_DATE.getTime() + variant * 86_400_000);
    case 'tinyint':
    case 'smallint':
    case 'mediumint':
    case 'int':
    case 'bigint':
    case 'decimal':
    case 'numeric':
    case 'float':
    case 'double':
      return numericValue(column.columnName, variant);
    case 'char':
    case 'varchar':
    case 'text':
    case 'tinytext':
    case 'mediumtext':
    case 'longtext':
      return stringValue(column, source, variant, tableName);
    case 'binary':
    case 'varbinary':
    case 'blob':
    case 'tinyblob':
    case 'mediumblob':
    case 'longblob':
      return Buffer.from(`seed-${tableName}-${variant}`);
    default:
      return column.columnDefault ?? null;
  }
}

async function loadMetadata(tx: SeedTransaction): Promise<Map<string, TableMeta>> {
  const rawColumns = await tx.$queryRawUnsafe<RawColumnMeta[]>(
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, DATA_TYPE AS dataType, COLUMN_TYPE AS columnType, CHARACTER_MAXIMUM_LENGTH AS characterMaxLength, IS_NULLABLE = 'YES' AS isNullable, COLUMN_DEFAULT AS columnDefault, EXTRA AS extra FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE()`,
  );
  const rawIndexes = await tx.$queryRawUnsafe<RawIndexMeta[]>(
    `SELECT TABLE_NAME AS tableName, INDEX_NAME AS indexName, COLUMN_NAME AS columnName, SEQ_IN_INDEX AS sequence, NON_UNIQUE AS nonUnique FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
  );
  const foreignKeys = await tx.$queryRawUnsafe<ForeignKeyMeta[]>(
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, REFERENCED_TABLE_NAME AS referencedTableName, REFERENCED_COLUMN_NAME AS referencedColumnName FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL`,
  );

  const columns: ColumnMeta[] = rawColumns.map((column) => ({
    ...column,
    characterMaxLength:
      column.characterMaxLength === null ? null : Number(column.characterMaxLength),
    isNullable: Boolean(Number(column.isNullable)),
  }));
  const indexes: IndexMeta[] = rawIndexes.map((index) => ({
    ...index,
    sequence: Number(index.sequence),
    nonUnique: Number(index.nonUnique),
  }));

  const tableNames = [...new Set(columns.map((column) => column.tableName).filter(tableIncluded))];
  const result = new Map<string, TableMeta>();

  for (const tableName of tableNames) {
    const tableColumns = columns.filter((column) => column.tableName === tableName);
    const tableIndexes = indexes.filter((index) => index.tableName === tableName);
    const primaryKeys = tableIndexes
      .filter((index) => index.indexName === 'PRIMARY')
      .sort((left, right) => left.sequence - right.sequence)
      .map((index) => index.columnName);
    const uniqueIndexes = [...new Map(
      tableIndexes
        .filter((index) => index.nonUnique === 0 && index.indexName !== 'PRIMARY')
        .reduce((groups, index) => {
          const values = groups.get(index.indexName) ?? [];
          values[index.sequence - 1] = index.columnName;
          groups.set(index.indexName, values);
          return groups;
        }, new Map<string, string[]>()),
    ).values()];

    result.set(tableName, {
      tableName,
      columns: tableColumns,
      primaryKeys,
      uniqueIndexes,
      foreignKeys: new Map(
        foreignKeys
          .filter((foreignKey) => foreignKey.tableName === tableName)
          .map((foreignKey) => [foreignKey.columnName, foreignKey]),
      ),
    });
  }

  return result;
}

function uniqueKey(row: Row, columns: string[]): string | null {
  const values = columns.map((column) => row[column]);
  if (values.some((value) => value === null || value === undefined)) return null;
  return values.map((value) => (typeof value === 'bigint' ? value.toString() : String(value))).join('\u001f');
}

function uniqueConflict(row: Row, rows: Row[], indexes: string[][]): boolean {
  return indexes.some((index) => {
    const key = uniqueKey(row, index);
    return key !== null && rows.some((existing) => uniqueKey(existing, index) === key);
  });
}

function applyForeignKeys(
  row: Row,
  meta: TableMeta,
  parentRows: Map<string, Row[]>,
  variant: number,
): boolean {
  for (const [columnName, foreignKey] of meta.foreignKeys) {
    const source = parentRows.get(foreignKey.referencedTableName);
    const column = meta.columns.find((item) => item.columnName === columnName);
    if (!source || source.length === 0) {
      if (column?.isNullable || column?.columnDefault !== null) continue;
      return false;
    }
    const parent = source[(variant - 1) % source.length];
    row[columnName] = parent[foreignKey.referencedColumnName];
  }
  return true;
}

async function expandTable(
  tx: SeedTransaction,
  meta: TableMeta,
  parentRows: Map<string, Row[]>,
): Promise<boolean> {
  const existing = await tx.$queryRawUnsafe<Row[]>(`SELECT * FROM ${quoteIdentifier(meta.tableName)}`);
  const target = targetFor(meta.tableName);
  if (existing.length >= target) {
    parentRows.set(meta.tableName, existing);
    return false;
  }

  const rows: Row[] = [];
  const insertableColumns = meta.columns.filter((column) => !column.extra.includes('auto_increment'));
  const trackedIndexes = meta.uniqueIndexes.length > 0 ? [meta.primaryKeys, ...meta.uniqueIndexes] : [meta.primaryKeys];
  const used = [...existing];

  for (let variant = existing.length + 1; variant <= target; variant += 1) {
    const source = existing.length > 0 ? existing[(variant - 1) % existing.length] : {};
    const row: Row = {};

    for (const column of insertableColumns) {
      const sourceValue = source[column.columnName];
      const foreignKey = meta.foreignKeys.get(column.columnName);
      if (foreignKey) continue;

      if ((column.columnName === 'createdAt' || column.columnName === 'updatedAt') && sourceValue instanceof Date) {
        row[column.columnName] = new Date(SEED_REFERENCE_DATE.getTime() + variant * 86_400_000);
        continue;
      }

      if (sourceValue !== undefined || !column.isNullable && column.columnDefault === null) {
        row[column.columnName] = scalarValue(column, sourceValue, variant, meta.tableName);
        continue;
      }

      if (column.columnDefault !== null) continue;
      if (!column.isNullable) row[column.columnName] = scalarValue(column, undefined, variant, meta.tableName);
    }

    if (!applyForeignKeys(row, meta, parentRows, variant)) return false;

    for (let attempt = 0; attempt < 100 && uniqueConflict(row, used.concat(rows), trackedIndexes); attempt += 1) {
      for (const index of trackedIndexes) {
        for (const columnName of index) {
          const column = meta.columns.find((item) => item.columnName === columnName);
          if (!column || meta.foreignKeys.has(columnName)) continue;
          row[columnName] = scalarValue(column, row[columnName], variant + attempt + 1, meta.tableName);
        }
      }
      if (!uniqueConflict(row, used.concat(rows), trackedIndexes)) break;
    }

    if (uniqueConflict(row, used.concat(rows), trackedIndexes)) return false;
    rows.push(row);
  }

  if (rows.length === 0) return false;

  const columnNames = insertableColumns
    .filter((column) => rows.some((row) => Object.prototype.hasOwnProperty.call(row, column.columnName)))
    .map((column) => column.columnName);
  if (columnNames.length === 0) return false;

  const placeholders = rows
    .map(() => `(${columnNames.map(() => '?').join(', ')})`)
    .join(', ');
  const values = rows.flatMap((row) => columnNames.map((columnName) => row[columnName]));
  await tx.$executeRawUnsafe(
    `INSERT INTO ${quoteIdentifier(meta.tableName)} (${columnNames.map(quoteIdentifier).join(', ')}) VALUES ${placeholders}`,
    ...values,
  );

  const refreshed = await tx.$queryRawUnsafe<Row[]>(`SELECT * FROM ${quoteIdentifier(meta.tableName)}`);
  parentRows.set(meta.tableName, refreshed);
  return true;
}

export async function seedSemanticCoverage(tx: SeedTransaction): Promise<void> {
  const metadata = await loadMetadata(tx);
  const parentRows = new Map<string, Row[]>();
  const tables = [...metadata.values()].sort((left, right) => left.foreignKeys.size - right.foreignKeys.size);

  for (const table of tables) {
    const rows = await tx.$queryRawUnsafe<Row[]>(`SELECT * FROM ${quoteIdentifier(table.tableName)}`);
    parentRows.set(table.tableName, rows);
  }

  for (let pass = 0; pass < tables.length; pass += 1) {
    let progressed = false;
    for (const table of tables) {
      if (await expandTable(tx, table, parentRows)) progressed = true;
    }
    if (!progressed) break;
  }
}
