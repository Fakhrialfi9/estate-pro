import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const SRC_ROOT = path.join(ROOT, 'src');
const ALLOWED_CROSS_MODULE_DEPENDENCIES = new Set([
  'src/modules/permissions/presentation/permissions.controller.ts->src/modules/auth/security/jwt-auth.guard.ts',
  'src/modules/property/listing/presentation/listing.controller.ts->src/modules/auth/security/jwt-auth.guard.ts',
  'src/modules/property/presentation/property-details.controller.ts->src/modules/auth/security/jwt-auth.guard.ts',
  'src/modules/property/presentation/property-extras.controller.ts->src/modules/auth/security/jwt-auth.guard.ts',
  'src/modules/property/presentation/property-lifecycle.controller.ts->src/modules/auth/security/jwt-auth.guard.ts',
  'src/modules/property/presentation/property-types.controller.ts->src/modules/auth/security/jwt-auth.guard.ts',
  'src/modules/property/presentation/property-master.controller.ts->src/modules/auth/security/jwt-auth.guard.ts',
  'src/modules/property/presentation/controllers/property.controller.ts->src/modules/auth/security/jwt-auth.guard.ts',
  'src/modules/property/presentation/controllers/property-category.controller.ts->src/modules/auth/security/jwt-auth.guard.ts',
  'src/modules/property/presentation/controllers/property-subcategory.controller.ts->src/modules/auth/security/jwt-auth.guard.ts',
  'src/modules/property/presentation/controllers/property-location.controller.ts->src/modules/auth/security/jwt-auth.guard.ts',
  'src/modules/property/presentation/controllers/property-facility.controller.ts->src/modules/auth/security/jwt-auth.guard.ts',
  'src/modules/roles/application/services/role-permission.service.ts->src/modules/permissions/domain/repositories/permission.repository.ts',
  'src/modules/roles/application/services/role-permission.service.ts->src/modules/permissions/application/policies/permission-authorization.policy.ts',
  'src/modules/roles/application/services/role-permission.service.ts->src/modules/permissions/domain/errors/permission.errors.ts',
  'src/modules/roles/presentation/roles.controller.ts->src/modules/auth/security/jwt-auth.guard.ts',
]);

async function collectTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectTypeScriptFiles(absolutePath)));
    else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) files.push(absolutePath);
  }
  return files;
}
function sourceImportSpecifiers(sourceText, filePath) {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const specifiers = [];
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (moduleSpecifier && ts.isStringLiteral(moduleSpecifier)) specifiers.push(moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) specifiers.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return specifiers;
}
async function resolveRelativeImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  let target = path.resolve(path.dirname(fromFile), specifier);
  if (target.endsWith('.js')) target = target.slice(0, -3) + '.ts';
  for (const candidate of [target, `${target}.ts`, path.join(target, 'index.ts')]) {
    try {
      if ((await stat(candidate)).isFile()) return path.normalize(candidate);
    } catch {
      continue;
    }
  }
  return null;
}
function moduleName(filePath) { const relative = path.relative(SRC_ROOT, filePath).split(path.sep); return relative[0] === 'modules' && relative[1] ? relative[1] : null; }
function relativeSourcePath(filePath) { return path.relative(ROOT, filePath).split(path.sep).join('/'); }
function dependencyKey(source, target) { return `${relativeSourcePath(source)}->${relativeSourcePath(target)}`; }

const files = await collectTypeScriptFiles(SRC_ROOT);
const graph = new Map(files.map((file) => [file, new Set()]));
for (const file of files) {
  const source = await readFile(file, 'utf8');
  for (const specifier of sourceImportSpecifiers(source, file)) {
    const target = await resolveRelativeImport(file, specifier);
    if (target && graph.has(target)) graph.get(file).add(target);
  }
}
const visiting = new Set(); const visited = new Set(); const stack = []; const cycles = [];
function visit(file) {
  if (visiting.has(file)) { const start = stack.indexOf(file); cycles.push([...stack.slice(start), file]); return; }
  if (visited.has(file)) return;
  visiting.add(file); stack.push(file);
  for (const dependency of graph.get(file) ?? []) visit(dependency);
  stack.pop(); visiting.delete(file); visited.add(file);
}
for (const file of files) visit(file);
if (cycles.length > 0) { console.error('Circular dependency detected:'); for (const cycle of cycles) console.error(`  ${cycle.map(relativeSourcePath).join(' -> ')}`); process.exit(1); }
const crossModuleViolations = [];
for (const [source, dependencies] of graph) {
  const sourceModule = moduleName(source); if (!sourceModule) continue;
  for (const target of dependencies) {
    const targetModule = moduleName(target); if (!targetModule || targetModule === sourceModule) continue;
    if (ALLOWED_CROSS_MODULE_DEPENDENCIES.has(dependencyKey(source, target))) continue;
    const targetRelative = path.relative(SRC_ROOT, target).split(path.sep);
    const targetIsPublicModule = targetRelative.length === 3 && targetRelative[0] === 'modules' && targetRelative[1] === targetModule && targetRelative[2] === `${targetModule}.module.ts`;
    if (!targetIsPublicModule) crossModuleViolations.push(`${relativeSourcePath(source)} -> ${relativeSourcePath(target)}`);
  }
}
if (crossModuleViolations.length > 0) { console.error('Illegal cross-module internal dependency detected:'); for (const violation of crossModuleViolations) console.error(`  ${violation}`); process.exit(1); }
console.log(`Architecture graph check passed: ${files.length} TypeScript source files, no circular dependencies, no illegal cross-module internal imports.`);