# Pattern: pipe

## Intent

Find all pipes.

A pipe means:

- `ClassDeclaration`
  - has `Decorator`
    - has descendant `Identifier` with text `Pipe`
    - that `Identifier` is imported from `@angular/core`
