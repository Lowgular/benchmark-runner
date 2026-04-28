# Pattern: signal-property

## Intent

Find all signal properties.

A signal property means:

- `ClassDeclaration`
  - has member `PropertyDeclaration`
    - whose type resolves to:
      - is of kind: `TypeAliasDeclaration`, `InterfaceDeclaration` or `ClassDeclaration`
      - name is one of the following `Signal`, `WritableSignal`, `InputSignal` or `ModelSignal`
      - it is imported from `@angular/core`

Prefer `HAS_DESCENDANT_TYPE_DECLARATION` when matching generic forms like `Signal<T>`.
