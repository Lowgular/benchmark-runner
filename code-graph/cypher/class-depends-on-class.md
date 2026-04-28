# class-depends-on-class

## Class can depend on another Class

```cypher
MATCH (c:ClassDeclaration)-[:DEPENDS_ON]->(dependency:ClassDeclaration)
RETURN c, dependency
LIMIT 50
```

## Anchor further constraints on the resolved dependency

```cypher
MATCH (c:ClassDeclaration)-[:DEPENDS_ON]->(dependency:ClassDeclaration)
MATCH (dependency) ... -- apply pattern constraints on dependency here
RETURN DISTINCT c.name, c.filePath
LIMIT 50
```
