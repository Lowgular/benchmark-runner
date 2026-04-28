# Pattern: component

## Intent

Find all components.

A component means:

- `ClassDeclaration`
  - has `Decorator`
    - has descendant `Identifier` with text `Component`
    - that `Identifier` is imported from `@angular/core`
