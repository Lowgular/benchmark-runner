# Pattern: property-template-binding

## Intent

Find all component properties that are referenced in the component template.

A template-bound property means:

- `ClassDeclaration`
  - has `Decorator` with `@Component` from `@angular/core`
  - has member `PropertyDeclaration`
    - is referenced in this component's template
