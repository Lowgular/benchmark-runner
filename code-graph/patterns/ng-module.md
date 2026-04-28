# Pattern: module

## Intent

Find all ngmodules.

An ngmodule means:

- `ClassDeclaration`
  - has `Decorator`
    - has descendant `Identifier` with text `NgModule`
    - that `Identifier` is imported from `@angular/core`
