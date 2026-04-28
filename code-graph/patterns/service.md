# Pattern: service

## Intent

Find all services.

A service means:

- `ClassDeclaration`
  - has `Decorator`
    - has descendant `Identifier` with text `Injectable`
    - that `Identifier` is imported from `@angular/core`
