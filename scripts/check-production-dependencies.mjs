import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const lockfile = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const packages = lockfile.packages ?? {};

if (!packages['']) {
  console.error('package-lock.json does not contain a root package entry.');
  process.exit(1);
}

const resolveDependency = (fromPath, dependencyName) => {
  let current = fromPath;
  while (true) {
    const candidate = current
      ? `${current}/node_modules/${dependencyName}`
      : `node_modules/${dependencyName}`;
    if (packages[candidate]) return candidate;
    if (!current) return undefined;
    const marker = current.lastIndexOf('/node_modules/');
    current = marker >= 0 ? current.slice(0, marker) : '';
  }
};

const productionPackages = new Set();
const queue = Object.keys(packageJson.dependencies ?? {}).map((name) => ({
  name,
  fromPath: '',
}));

while (queue.length > 0) {
  const current = queue.pop();
  if (!current) continue;
  const path = resolveDependency(current.fromPath, current.name);
  if (!path || productionPackages.has(path)) continue;
  productionPackages.add(path);
  const manifest = packages[path];
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    queue.push({ name, fromPath: path });
  }
  for (const name of Object.keys(manifest.optionalDependencies ?? {})) {
    queue.push({ name, fromPath: path });
  }
}

const reachableNames = new Set(
  [...productionPackages]
    .map((path) => packages[path]?.name)
    .filter((name) => typeof name === 'string'),
);

let audit;
try {
  audit = JSON.parse(
    execFileSync('npm', ['audit', '--omit=dev', '--audit-level=high', '--json'], {
      encoding: 'utf8',
    }),
  );
} catch (error) {
  const output =
    error &&
    typeof error === 'object' &&
    'stdout' in error &&
    typeof error.stdout === 'string'
      ? error.stdout
      : '';
  if (!output) {
    console.error('Production dependency audit did not produce JSON output.');
    process.exit(1);
  }
  audit = JSON.parse(output);
}

const vulnerableNames = Object.keys(audit.vulnerabilities ?? {});
const blocking = vulnerableNames.filter((name) => reachableNames.has(name));
const nonProduction = vulnerableNames.filter((name) => !reachableNames.has(name));

if (blocking.length > 0) {
  console.error(
    `Blocking production dependency vulnerabilities: ${blocking.join(', ')}`,
  );
  process.exit(1);
}

if (nonProduction.length > 0) {
  console.warn(
    `Ignoring vulnerabilities outside the production dependency graph: ${nonProduction.join(', ')}`,
  );
}

console.log(
  `Production dependency security gate passed (${productionPackages.size} reachable packages).`,
);
