const ts = require('./node_modules/typescript/lib/typescript.js');
const fs = require('fs');
const path = require('path');

// Find all .ts files that might contain components
const searchDirs = ['./web/src', './api/src'];
const tsFiles = [];

function findTsFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'tmp') continue;
      findTsFiles(fullPath);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      tsFiles.push(fullPath);
    }
  }
}

for (const dir of searchDirs) {
  findTsFiles(dir);
}

// Signal type names from @angular/core
const SIGNAL_TYPE_NAMES = new Set(['Signal', 'WritableSignal', 'InputSignal', 'ModelSignal']);

// Angular core signal functions (including from submodules)
const SIGNAL_FUNC_NAMES = new Set(['signal', 'input', 'computed', 'model', 'toSignal']);
const SIGNAL_METHOD_NAMES = new Set(['asReadonly', 'required']);

const results = [];

for (const filePath of tsFiles) {
  const source = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);

  // Collect all imports from @angular/core and submodules
  const angularImports = new Map(); // alias -> original name

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const moduleText = node.moduleSpecifier.text;
      if (moduleText === '@angular/core' || moduleText.startsWith('@angular/core/')) {
        if (node.importClause && node.importClause.namedBindings) {
          const bindings = node.importClause.namedBindings;
          if (ts.isNamedImports(bindings)) {
            for (const elem of bindings.elements) {
              const originalName = elem.propertyName ? elem.propertyName.text : elem.name.text;
              const aliasName = elem.name.text;
              angularImports.set(aliasName, originalName);
            }
          }
        }
      }
    }
  });

  if (angularImports.size === 0) continue;

  // Find @Component decorated classes
  ts.forEachChild(sourceFile, (node) => {
    if (!ts.isClassDeclaration(node)) return;

    const decorators = ts.getDecorators(node);
    if (!decorators) return;

    let isComponent = false;
    let templateText = null;

    for (const decorator of decorators) {
      if (ts.isCallExpression(decorator.expression)) {
        const expr = decorator.expression;
        if (ts.isIdentifier(expr.expression) && expr.expression.text === 'Component') {
          isComponent = true;
          // Extract template
          if (expr.arguments.length > 0 && ts.isObjectLiteralExpression(expr.arguments[0])) {
            const obj = expr.arguments[0];
            for (const prop of obj.properties) {
              if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                if (prop.name.text === 'template' && ts.isStringLiteralLike(prop.initializer)) {
                  templateText = prop.initializer.text;
                }
                if (prop.name.text === 'templateUrl' && ts.isStringLiteralLike(prop.initializer)) {
                  // Read external template file
                  const dir = path.dirname(filePath);
                  const tplPath = path.join(dir, prop.initializer.text);
                  if (fs.existsSync(tplPath)) {
                    templateText = fs.readFileSync(tplPath, 'utf8');
                  }
                }
              }
            }
          }
        }
      }
    }

    if (!isComponent || !templateText) return;

    const className = node.name ? node.name.text : 'Anonymous';

    // Find signal properties in this class
    for (const member of node.members) {
      if (!ts.isPropertyDeclaration(member)) continue;
      if (!ts.isIdentifier(member.name)) continue;

      const propName = member.name.text;
      const initializer = member.initializer;

      if (!initializer) continue;

      // Check if initializer is a call expression to signal(), input(), computed(), model(), etc.
      let isSignalProperty = false;

      if (ts.isCallExpression(initializer)) {
        const callExpr = initializer.expression;

        // Direct call: signal(), input(), computed(), model(), toSignal()
        if (ts.isIdentifier(callExpr)) {
          const funcName = callExpr.text;
          if (angularImports.has(funcName)) {
            const originalName = angularImports.get(funcName);
            if (SIGNAL_FUNC_NAMES.has(originalName)) {
              isSignalProperty = true;
            }
          }
        }

        // Chained call: input.required(), model.required(), etc.
        if (ts.isPropertyAccessExpression(callExpr)) {
          const propAccess = callExpr;
          const methodName = propAccess.name.text;
          if (SIGNAL_METHOD_NAMES.has(methodName)) {
            isSignalProperty = true;
          }
          // Also check if the object being accessed is a signal function
          if (ts.isIdentifier(propAccess.expression)) {
            const objName = propAccess.expression.text;
            if (angularImports.has(objName)) {
              const originalName = angularImports.get(objName);
              if (SIGNAL_FUNC_NAMES.has(originalName)) {
                isSignalProperty = true;
              }
            }
          }
        }
      }

      // Check type annotation for Signal<T>, WritableSignal<T>, etc.
      if (member.type) {
        function checkTypeForSignal(typeNode) {
          if (ts.isTypeReferenceNode(typeNode)) {
            const typeName = typeNode.typeName;
            if (ts.isIdentifier(typeName) && SIGNAL_TYPE_NAMES.has(typeName.text)) {
              return true;
            }
          }
          return false;
        }
        if (checkTypeForSignal(member.type)) {
          isSignalProperty = true;
        }
      }

      if (!isSignalProperty) continue;

      // Check if this property is referenced in the template
      // Look for patterns: propName(), propName, [propName], {{ propName
      const propPattern = new RegExp(`\\b${propName}\\b`, 'g');
      const matches = templateText.match(propPattern);

      if (matches && matches.length > 0) {
        results.push({
          name: propName,
          filePath: filePath,
          component: className,
        });
      }
    }
  });
}

// Deduplicate
const seen = new Set();
const unique = results.filter(r => {
  const key = `${r.filePath}:${r.name}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

// Output as JSON
console.log(JSON.stringify(unique, null, 2));
