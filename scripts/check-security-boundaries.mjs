#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SCHEMA_ROOT = path.join(ROOT, 'prisma', 'schema', 'users');

const requiredTables = new Map([
  ['authentication_users', 'authentication'],
  ['authentication_user_credentials', 'authentication'],
  ['authentication_user_sessions', 'security'],
  ['authentication_user_two_factors', 'security'],
  ['authentication_user_security', 'security'],
  ['authentication_user_profiles', 'users'],
  ['authorization_roles', 'authorization'],
  ['authorization_permissions', 'authorization'],
  ['authorization_user_roles', 'authorization'],
  ['authorization_role_permissions', 'authorization'],
  ['audit_logs', 'audit'],
  ['audit_log_changes', 'audit'],
]);

const files = await collectPrismaFiles(SCHEMA_ROOT);
const models = new Map();

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const modelMatch = source.match(/model\s+(\w+)\s*\{/);
  const tableMatch = source.match(/@@map\("([^"]+)"\)/);

  if (modelMatch && tableMatch) {
    models.set(tableMatch[1], {
      model: modelMatch[1],
      path: path.relative(ROOT, file).split(path.sep).join('/'),
      source,
    });
  }
}

const failures = [];

for (const [table, owner] of requiredTables) {
  const model = models.get(table);
  if (!model) {
    failures.push(`Missing required persistence boundary: ${table} (owner: ${owner})`);
  }
}

// Match persisted scalar credential fields, not relation names such as
// passwordResetTokens, which are valid identity-boundary relationships.
assertAbsent(
  'authentication_user_profiles',
  /\bpassword(?:Hash|_hash)?\s+(?:String|Bytes|Json|Int|Boolean|DateTime)\b/i,
);
assertAbsent(
  'authentication_users',
  /\bpassword(?:Hash|_hash)?\s+(?:String|Bytes|Json|Int|Boolean|DateTime)\b/i,
);
assertAbsent('authorization_roles', /\b(?:password|credential|secret)\s+/i);
assertAbsent('authorization_permissions', /\b(?:password|credential|secret)\s+/i);
assertAbsent(
  'audit_logs',
  /\b(?:password|password_hash|token|secret|credential)\s+/i,
);

const identity = models.get('authentication_users');
if (identity && !/uuid\s+String\s+@unique/.test(identity.source)) {
  failures.push('authentication_users must expose a unique stable UUID identity.');
}

const credential = models.get('authentication_user_credentials');
if (credential && !/passwordHash\s+String/.test(credential.source)) {
  failures.push('Credential owner must persist passwordHash only in authentication_user_credentials.');
}

for (const [table, relationPattern, description] of [
  ['authentication_user_profiles', /user\s+AuthenticationUser\s+@relation/, 'profile -> identity'],
  ['authentication_user_security', /user\s+AuthenticationUser\s+@relation/, 'security -> identity'],
  ['authentication_user_sessions', /user\s+AuthenticationUser\s+@relation/, 'session -> identity'],
  ['authentication_user_two_factors', /user\s+AuthenticationUser\s+@relation/, '2FA -> identity'],
  ['authentication_user_credentials', /user\s+AuthenticationUser\s+@relation/, 'credential -> identity'],
]) {
  const model = models.get(table);
  if (model && !relationPattern.test(model.source)) {
    failures.push(`${description} relation is missing for ${table}.`);
  }
}

if (failures.length) {
  console.error('Security boundary check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `Security boundary check passed: ${requiredTables.size} owned persistence boundaries verified.`,
);

async function collectPrismaFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await collectPrismaFiles(absolutePath)));
    } else if (entry.isFile() && entry.name.endsWith('.prisma')) {
      result.push(absolutePath);
    }
  }

  return result;
}

function assertAbsent(table, pattern) {
  const model = models.get(table);
  if (model && pattern.test(model.source)) {
    failures.push(`${table} contains data that belongs to another security boundary.`);
  }
}
