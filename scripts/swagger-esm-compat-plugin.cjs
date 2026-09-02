const ts = require('typescript');
const path = require('path');
const swaggerPlugin = require('@nestjs/swagger/plugin');

const INVALID_IMPORT_PATTERN = /^\((?:await import)\(["'](.+)["']\)\)\.([A-Za-z_$][\w$]*)$/;
const INVALID_ARRAY_IMPORT_PATTERN = /^\[\((?:await import)\(["'](.+)["']\)\)\.([A-Za-z_$][\w$]*)\]$/;

function normalizeModulePath(modulePath) {
  return modulePath.replace(/\\/g, '/').replace(/\.js$/, '');
}

function findExistingImport(sourceFile, modulePath, importedName) {
  const target = normalizeModulePath(modulePath);

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }

    if (normalizeModulePath(statement.moduleSpecifier.text) !== target) {
      continue;
    }

    const clause = statement.importClause;
    if (!clause) {
      continue;
    }

    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
      return `${clause.namedBindings.name.text}.${importedName}`;
    }

    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        const imported = element.propertyName?.text ?? element.name.text;
        if (imported === importedName) {
          return element.name.text;
        }
      }
    }
  }

  return undefined;
}

function isSameFileImport(sourceFile, modulePath) {
  const resolved = path.resolve(path.dirname(sourceFile.fileName), modulePath);
  const normalized = normalizeModulePath(resolved);
  const source = normalizeModulePath(sourceFile.fileName);
  return normalized === source;
}

function createStaticImport(factory, modulePath, namespaceName) {
  return factory.createImportDeclaration(
    undefined,
    factory.createImportClause(
      false,
      undefined,
      factory.createNamespaceImport(factory.createIdentifier(namespaceName)),
    ),
    factory.createStringLiteral(modulePath),
    undefined,
  );
}

function before(options = {}, program) {
  const swaggerTransformerFactory = swaggerPlugin.before(options, program);
  const swaggerTransformer = undefined;

  return (context) => {
    const applySwagger = swaggerTransformerFactory(context);
    const hoistedImports = new Map();

    return (sourceFile) => {
      hoistedImports.clear();

      const swaggerSourceFile = applySwagger(sourceFile);
      if (!swaggerSourceFile || !ts.isSourceFile(swaggerSourceFile)) {
        return swaggerSourceFile;
      }

      const factory = context.factory;
      const visitor = (node) => {
        if (!ts.isIdentifier(node)) {
          return ts.visitEachChild(node, visitor, context);
        }

        const text = node.text;
        const scalar = text.match(INVALID_IMPORT_PATTERN);
        const array = text.match(INVALID_ARRAY_IMPORT_PATTERN);
        const match = scalar ?? array;

        if (!match) {
          return node;
        }

        const modulePath = match[1];
        const importedName = match[2];

        if (isSameFileImport(swaggerSourceFile, modulePath)) {
          return factory.createIdentifier(array ? `[${importedName}]` : importedName);
        }

        const existingImport = findExistingImport(
          swaggerSourceFile,
          modulePath,
          importedName,
        );
        if (existingImport) {
          return factory.createIdentifier(array ? `[${existingImport}]` : existingImport);
        }

        let namespaceName = hoistedImports.get(modulePath);
        if (!namespaceName) {
          namespaceName = `openapi_import_${hoistedImports.size + 1}`;
          hoistedImports.set(modulePath, namespaceName);
        }

        const reference = `${namespaceName}.${importedName}`;
        return factory.createIdentifier(array ? `[${reference}]` : reference);
      };

      const transformed = ts.visitNode(swaggerSourceFile, visitor);
      if (!transformed || !ts.isSourceFile(transformed) || hoistedImports.size === 0) {
        return transformed;
      }

      const importDeclarations = Array.from(hoistedImports.entries()).map(
        ([modulePath, namespaceName]) =>
          createStaticImport(factory, modulePath, namespaceName),
      );

      return factory.updateSourceFile(transformed, [
        ...importDeclarations,
        ...transformed.statements,
      ]);
    };
  };
}

module.exports = { before };
