# template-input-binding

## ClassDeclaration Template binds input to another ClassDeclaration

```cypher
MATCH (parent:ClassDeclaration)-[:BINDS_INPUT]->(child:ClassDeclaration)
RETURN parent, child
LIMIT 50
```
