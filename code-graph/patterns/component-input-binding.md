# Pattern: component-input-binding

## Intent

Find all component binding to another component or directive using input

A template-bound property means:

- the binding target is a `ClassDeclaration`
  - decorated with `@Component` or `@Directive` from `@angular/core`
  - has a matching `@Input()` or signal `input()` property
