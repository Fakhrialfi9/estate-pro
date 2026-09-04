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

const productionTree = runJson('npm', ['ls', '--omit=dev', '--all', '--json']);
if (productionTree.value === null) {
  console.error('Unable to resolve the production dependency tree.');
  process.exit(1);
}

const reachable = new Set();
const visit = (node) => {
  if (!node || typeof node !== 'object') return;
  if (typeof node.name === 'string') reachable.add(node.name);
  if (node.dependencies && typeof node.dependencies === 'object') {
    for (const dependency of Object.values(node.dependencies)) visit(dependency);
  }
};
visit(productionTree.value);

const vulnerabilities = audit.value.vulnerabilities ?? {};
const blocking = [];
const ignoredNonProduction = [];

for (const [name, advisory] of Object.entries(vulnerabilities)) {
  if (reachable.has(name)) {
    blocking.push(name);
  } else {
    ignoredNonProduction.push(name);
  }
}

if (blocking.length > 0) {
  console.error(
    `Blocking production dependency vulnerabilities: ${blocking.join(', ')}`,
  );
  process.exit(1);
}

if (ignoredNonProduction.length > 0) {
  console.warn(
    `Ignoring vulnerabilities that are not reachable from the production dependency tree: ${ignoredNonProduction.join(', ')}`,
  );
}

console.log('Production dependency security gate passed.');
