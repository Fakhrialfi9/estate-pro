const path = require('node:path');
const ts = require('typescript');
const swaggerPlugin = require('@nestjs/swagger/plugin');

const DYNAMIC_IMPORT_REFERENCE = /\(?await import\("([^"]+)"\)\)?\.([A-Za-z_$][\w$]*)/g;
const FILE_EXTENSION = /\.[cm]?js$/;

function before(options = {}, program) {
  const swaggerTransformer = swaggerPlugin.before(options, program);

  return (context) => {
    const transformSwagger = swaggerTransformer(context);

    return (sourceFile) => {
      const transformed = transformSwagger(sourceFile);
      const hoistedImports = new Map();
      let namespaceIndex = 0;

      const getNamespace = (importPath) => {
        let namespaceName = hoistedImports.get(importPath);
        if (!namespaceName) {
          namespaceIndex += 1;
          namespaceName = `openapi_import_${namespaceIndex}`;
          hoistedImports.set(importPath, namespaceName);
        }
        return namespaceName;
      };

      const sourceFileName = normalizeFilePath(sourceFile.fileName);
      const sourceWithoutExtension = sourceFileName.replace(FILE_EXTENSION, '');

      const rewriteReference = (text) =>
        text.replace(
          DYNAMIC_IMPORT_REFERENCE,
          (fullReference, importPath, typeName) => {
            if (!importPath.startsWith('.')) {
              return `${getNamespace(importPath)}.${typeName}`;
            }

            const importedFile = normalizeFilePath(
              path.resolve(path.dirname(sourceFileName), importPath),
            ).replace(FILE_EXTENSION, '');

            if (importedFile === sourceWithoutExtension) {
              return typeName;
            }

            return `${getNamespace(importPath)}.${typeName}`;
          },
        );

      const rewritten = ts.visitNode(transformed, function visit(node) {
        if (ts.isIdentifier(node) && node.text.includes('await import(')) {
          const replacement = rewriteReference(node.text);
          if (replacement !== node.text) {
            return context.factory.createIdentifier(replacement);
          }
        }

        return ts.visitEachChild(node, visit, context);
      });

      if (hoistedImports.size === 0) {
        return rewritten;
      }

      const importDeclarations = Array.from(hoistedImports, (
        [importPath, namespaceName],
      ) =>
        context.factory.createImportDeclaration(
          undefined,
          context.factory.createImportClause(
            false,
            undefined,
            context.factory.createNamespaceImport(
              context.factory.createIdentifier(namespaceName),
            ),
          ),
          context.factory.createStringLiteral(importPath),
          undefined,
        ),
      );

      return context.factory.updateSourceFile(rewritten, [
        ...importDeclarations,
        ...rewritten.statements,
      ]);
    };
  };
}

function normalizeFilePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

module.exports = { before };
