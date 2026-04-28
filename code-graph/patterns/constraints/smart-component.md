# Constraint: smart-component

## Intent fragment

Narrow a component to one that injects a data service.

A smart component means a component where:

- has member `PropertyDeclaration`
  - whose type resolves to `ClassDeclaration`
    - decorated with `@Injectable` from `@angular/core`
    - has member `PropertyDeclaration`
      - whose type resolves to `HttpClient` from `@angular/common/http`
