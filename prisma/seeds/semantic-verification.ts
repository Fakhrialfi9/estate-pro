import type { PrismaClient } from '../generated/prisma/client.ts';

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

type TableNameRow = { tableName: string };
type CountRow = { count: bigint | number };
type ForeignKeyRow = {
  tableName: string;
  columnName: string;
  referencedTableName: string;
  referencedColumnName: string;
};

function quoteIdentifier(value: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }
  return `\`${value}\``;
}

function included(tableName: string): boolean {
  if (EXCLUDED_TABLES.has(tableName)) return false;
  return INCLUDED_PREFIXES.some((prefix) => tableName.startsWith(prefix));
}

function targetFor(tableName: string): number {
  if (REFERENCE_TABLES.has(tableName)) return 1;
  return TARGET_OVERRIDES[tableName] ?? 10;
}

async function countTable(prisma: PrismaClient, tableName: string): Promise<number> {
  const [row] = await prisma.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)}`,
  );
  return Number(row?.count ?? 0);
}

export async function verifySemanticSeedCoverage(prisma: PrismaClient): Promise<void> {
  const tableRows = await prisma.$queryRawUnsafe<TableNameRow[]>(
    `SELECT TABLE_NAME AS tableName FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`,
  );
  const tables = tableRows.map(({ tableName }) => tableName).filter(included);

  const underMinimum: string[] = [];
  for (const tableName of tables) {
    const count = await countTable(prisma, tableName);
    const minimum = targetFor(tableName);
    if (count < minimum) underMinimum.push(`${tableName}: expected >= ${minimum}, got ${count}`);
  }

  if (underMinimum.length > 0) {
    throw new Error(`Semantic seed coverage failed: ${underMinimum.join('; ')}`);
  }

  const foreignKeys = await prisma.$queryRawUnsafe<ForeignKeyRow[]>(
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, REFERENCED_TABLE_NAME AS referencedTableName, REFERENCED_COLUMN_NAME AS referencedColumnName FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL`,
  );
  const orphaned: string[] = [];

  for (const foreignKey of foreignKeys) {
    if (!included(foreignKey.tableName) || EXCLUDED_TABLES.has(foreignKey.referencedTableName)) continue;
    const [row] = await prisma.$queryRawUnsafe<CountRow[]>(
      `SELECT COUNT(*) AS count FROM ${quoteIdentifier(foreignKey.tableName)} child LEFT JOIN ${quoteIdentifier(foreignKey.referencedTableName)} parent ON child.${quoteIdentifier(foreignKey.columnName)} = parent.${quoteIdentifier(foreignKey.referencedColumnName)} WHERE child.${quoteIdentifier(foreignKey.columnName)} IS NOT NULL AND parent.${quoteIdentifier(foreignKey.referencedColumnName)} IS NULL`,
    );
    const count = Number(row?.count ?? 0);
    if (count > 0) {
      orphaned.push(`${foreignKey.tableName}.${foreignKey.columnName} -> ${foreignKey.referencedTableName}.${foreignKey.referencedColumnName}: ${count}`);
    }
  }

  if (orphaned.length > 0) {
    throw new Error(`Semantic seed relationship verification failed: ${orphaned.join('; ')}`);
  }
}
