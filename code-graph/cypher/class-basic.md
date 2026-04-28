# class-basic

## useCase

Find all class declarations.

## whenToUse

- User asks for classes without framework/decorator constraints.
- Examples: "find all classes", "list class declarations".

## composition

- requiredNodes:
  - `ClassDeclaration`
- requiredRelationships:
  - none
- requiredConstraints:
  - query starts with `MATCH`
  - query includes `RETURN`

## exampleMinimal

```cypher
MATCH (c:ClassDeclaration)
RETURN c.id, c.name, c.filePath
LIMIT 50
```

## antiPatterns

- Using short label `Class` instead of `ClassDeclaration`.
- Returning extra fields unless requested.
