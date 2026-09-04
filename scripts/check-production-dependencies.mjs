import { execFileSync } from 'node:child_process';

const runJson = (command, args) => {
  try {
    return {
      status: 0,
      value: JSON.parse(execFileSync(command, args, { encoding: 'utf8' })),
    };
  } catch (error) {
    const output =
      error &&
      typeof error === 'object' &&
      'stdout' in error &&
      typeof error.stdout === 'string'
        ? error.stdout
        : '';
    return {
      status:
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        typeof error.status === 'number'
          ? error.status
          : 1,
      value: output ? JSON.parse(output) : null,
    };
  }
};

const audit = runJson('npm', [
  'audit',
  '--omit=dev',
  '--audit-level=high',
  '--json',
]);
if (audit.value === null) {
  console.error('Production dependency audit did not produce JSON output.');
  process.exit(1);
}

const vulnerabilities = audit.value.vulnerabilities ?? {};
const prodTree = runJson('npm', [
  'ls',
  '--omit=dev',
  'mysql2',
  '--all',
  '--json',
]);
const mysql2PresentInProduction =
  prodTree.value !== null &&
  Boolean(prodTree.value.dependencies?.mysql2 || prodTree.value.name === 'mysql2');

const blocking = [];
const waived = [];

for (const [name, advisory] of Object.entries(vulnerabilities)) {
  const entries = Array.isArray(advisory.via) ? advisory.via : [];
  const isPrismaDevToolPath =
    name === 'mysql2' &&
    !mysql2PresentInProduction &&
    entries.some(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof entry.url === 'string' &&
        (entry.url.includes('GHSA-3f6p-5ww8-9rcr') ||
          entry.url.includes('GHSA-rgwj-5xj2-c3m3')),
    );

  if (isPrismaDevToolPath) {
    waived.push(name);
  } else {
    blocking.push(name);
  }
}

if (blocking.length > 0) {
  console.error(
    `Blocking production dependency vulnerabilities: ${blocking.join(', ')}`,
  );
  process.exit(1);
}

if (waived.length > 0) {
  console.warn(
    `Non-runtime Prisma/mysql2 advisory ignored because mysql2 is absent from the production dependency tree: ${waived.join(', ')}`,
  );
}

console.log('Production dependency security gate passed.');
