# Constraint: data-service

## Intent fragment

Narrow a service to one that uses `HttpClient` from `@angular/common/http`:

- has member `PropertyDeclaration`
  - whose type resolves to `HttpClient` from `@angular/common/http`
- has member `MethodDeclaration`
  - has descendant `PropertyAccessExpression` referencing the `HttpClient` property
