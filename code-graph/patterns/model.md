# Pattern: model

## Intent

Find all models.

A model means a structural data declaration: an interface, a type alias, or (in some cases) a class — characterized by having data-shaped members rather than behavior.

A model means:

- `InterfaceDeclaration`, `TypeAliasDeclaration`, or `ClassDeclaration`
  - has at least one of these members:
    - `PropertySignature` (interface / type-alias property)
    - `PropertyDeclaration` (class property)
    - `GetAccessor` (getter accessor)
    - `MethodSignature` with a return type (interface / type-alias getter-style method)
    - `MethodDeclaration` with a return type (class getter-style method)

Notes:

- Immutability of getter methods cannot be inferred from an `InterfaceDeclaration` or `TypeAliasDeclaration`. Treat any method with a return type as a candidate getter.
- `ClassDeclaration` qualifies as a model only when it has data-shaped members; classes that are decorated (`@Component`, `@Injectable`, `@Directive`, `@Pipe`, `@NgModule`) are NOT models — they are framework constructs.
- Prefer matching by the presence of the data members listed above. If a `ClassDeclaration` has any decorator, exclude it from the model set.
