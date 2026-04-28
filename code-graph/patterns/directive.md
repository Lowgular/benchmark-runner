# Pattern: directive

## Intent

Find all directives.

A directive means:

- `ClassDeclaration`
  - has `Decorator`
    - has descendant `Identifier` with text `Directive`
    - that `Identifier` is imported from `@angular/core`
