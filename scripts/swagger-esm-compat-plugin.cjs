const ts = require('typescript');
const path = require('path');
const swaggerPlugin = require('@nestjs/swagger/plugin');

const INVALID_IMPORT_PATTERN = /^\(await import\(["'](.+)["']\)\)\.([A-Za-z_$][\w$]*)$/;
const INVALID_ARRAY_IMPORT_PATTERN = /^\[\(await import\(["'](.+)["']\)\)\.([A-Za-z_$][\w$]*)\]$/;

function normalizeModulePath(modulePath) {
  return modulePath.replace(/\\/g, '/').replace(/\.[cm]?js$/, '');
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
  return normalizeModulePath(resolved) === normalizeModulePath(sourceFile.fileName);
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

  return (context) => {
    const applySwagger = swaggerTransformerFactory(context);

    return (sourceFile) => {
      const swaggerSourceFile = applySwagger(sourceFile);
      if (!swaggerSourceFile || !ts.isSourceFile(swaggerSourceFile)) {
        return swaggerSourceFile;
      }

      const hoistedImports = new Map();
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
        let reference;

        if (isSameFileImport(swaggerSourceFile, modulePath)) {
          reference = importedName;
        } else {
          reference = findExistingImport(
            swaggerSourceFile,
            modulePath,
            importedName,
          );

          if (!reference) {
            let namespaceName = hoistedImports.get(modulePath);
            if (!namespaceName) {
              namespaceName = `openapi_import_${hoistedImports.size + 1}`;
              hoistedImports.set(modulePath, namespaceName);
            }
            reference = `${namespaceName}.${importedName}`;
          }
        }

        if (array) {
          return factory.createArrayLiteralExpression([
            factory.createIdentifier(reference),
          ]);
        }

        return factory.createIdentifier(reference);
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
