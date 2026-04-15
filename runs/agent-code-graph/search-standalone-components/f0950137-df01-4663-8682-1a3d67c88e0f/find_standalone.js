const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const files = process.argv.slice(2);

let results = [];

for (const file of files) {
  const program = ts.createProgram([file], { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS });
  const sourceFile = program.getSourceFile(file);

  if (!sourceFile) continue;

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isClassDeclaration(node) && node.decorators) {
      for (const decorator of node.decorators) {
        if (ts.isCallExpression(decorator.expression)) {
          const expression = decorator.expression.expression;
          if (expression.getText() === 'Component') {
            // Check for standalone: true
            const arg = decorator.expression.arguments[0];
            let isStandalone = false;
            if (arg && ts.isObjectLiteralExpression(arg)) {
              const standaloneProp = arg.properties.find(
                (prop) => ts.isPropertyAssignment(prop) && prop.name.getText() === 'standalone'
              );
              if (standaloneProp && ts.isPropertyAssignment(standaloneProp)) {
                if (standaloneProp.initializer.kind === ts.SyntaxKind.TrueKeyword) {
                  isStandalone = true;
                }
              }
            }

            if (isStandalone) {
              if (node.name) {
                results.push({ filePath: path.resolve(file), name: node.name.getText(), standalone: true });
              }
            } else {
                // If standalone property is missing, it defaults to true in modern Angular, 
                // but let's check if it's explicitly set to false.
                let explicitlyFalse = false;
                if (arg && ts.isObjectLiteralExpression(arg)) {
                  const standaloneProp = arg.properties.find(
                    (prop) => ts.isPropertyAssignment(prop) && prop.name.getText() === 'standalone'
                  );
                  if (standaloneProp && ts.isPropertyAssignment(standaloneProp)) {
                    if (standaloneProp.initializer.kind === ts.SyntaxKind.FalseKeyword) {
                      explicitlyFalse = true;
                    }
                  }
                }
                if (!explicitlyFalse) {
                    if (node.name) {
                        results.push({ filePath: path.resolve(file), name: node.name.getText(), standalone: 'default/true' });
                    }
                }
            }
          }
        }
      }
    }
  });
}

console.log(JSON.stringify(results, null, 2));
