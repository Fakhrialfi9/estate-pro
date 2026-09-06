import type { PrismaService } from '../../../src/infrastructure/database/prisma/prisma.service.js';

type ForeignKeyRow = {
  TABLE_NAME: string;
  REFERENCED_TABLE_NAME: string;
};

function quoteIdentifier(value: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }
  return `\`${value}\``;
}

/**
 * Deletes the complete property-owned relational graph in dependency order.
 * E2E suites intentionally clean all property data, including rows created by
 * seed expansion, so the cleanup must not assume a fixed list of child tables.
 */
export async function cleanupPropertyGraph(prisma: PrismaService): Promise<void> {
  const foreignKeys = await prisma.$queryRawUnsafe<ForeignKeyRow[]>(
    `SELECT TABLE_NAME, REFERENCED_TABLE_NAME
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND REFERENCED_TABLE_NAME IS NOT NULL`,
  );

  const tables = new Set<string>(['properties']);
  let changed = true;
  while (changed) {
    changed = false;
    for (const foreignKey of foreignKeys) {
      if (tables.has(foreignKey.REFERENCED_TABLE_NAME) && !tables.has(foreignKey.TABLE_NAME)) {
        tables.add(foreignKey.TABLE_NAME);
        changed = true;
      }
    }
  }

  const children = new Map<string, Set<string>>();
  for (const table of tables) children.set(table, new Set());
  for (const foreignKey of foreignKeys) {
    if (!tables.has(foreignKey.TABLE_NAME) || !tables.has(foreignKey.REFERENCED_TABLE_NAME)) continue;
    children.get(foreignKey.REFERENCED_TABLE_NAME)?.add(foreignKey.TABLE_NAME);
  }

  const ordered: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (table: string): void => {
    if (visited.has(table)) return;
    if (visiting.has(table)) return;
    visiting.add(table);
    for (const child of children.get(table) ?? []) visit(child);
    visiting.delete(table);
    visited.add(table);
    ordered.push(table);
  };

  visit('properties');

  for (const table of ordered) {
    await prisma.$executeRawUnsafe(`DELETE FROM ${quoteIdentifier(table)}`);
  }
}
