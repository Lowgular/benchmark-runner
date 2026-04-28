# Pattern: method

## Intent

Find all methods.

A method can mean many AST nodes. Depending on context it can be either `MethodDeclaration` (if they are part of `ClassDeclaration`) or `MethodSignature` (if they are parts of `InterfaceDeclaration` or `TypeAliasDeclaration`).

If you do not know the context then assume both AST nodes.

## Return type

One of the most important information about the method is return type.

### Identifier

sometimes the type declaration name is clearly defined as `X` which represents some identifier.

find all methods returning `X`

we could use relationship

- `MethodDeclaration` or `MethodSignature`
  - has descendant type declaration of `X`
