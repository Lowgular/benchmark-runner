# method-basic

## Find all methods

```cypher
MATCH (m:MethodDeclaration|MethodSignature)
RETURN m
LIMIT 50
```

## Class methods

```cypher
MATCH (c:ClassDeclaration)-[:HAS_MEMBER]->(m:MethodDeclaration)
RETURN c, m
LIMIT 50
```

## Interface or TypeAlias methods

```cypher
MATCH (decl:InterfaceDeclaration|TypeAliasDeclaration)-[:HAS_MEMBER]->(m:MethodSignature)
RETURN decl, m
LIMIT 50
```

## Find methods that return 'X'

```cypher
MATCH (m:MethodDeclaration|MethodSignature)-[:HAS_DESCENDANT_TYPE_DECLARATION]->(t {name: 'X'})
RETURN m,t
LIMIT 50
```

Note: we look for specific type declaration anywhere in the resolved return type (union, generics, etc.)
