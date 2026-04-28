# template-binding-basic

## ClassDeclaration properties referenced in template

```cypher
MATCH (c:ClassDeclaration)-[:HAS_TEMPLATE_BINDING]->(:Identifier)-[:HAS_ANCESTOR]->(p:PropertyDeclaration)
RETURN c, p
LIMIT 50
```

## ClassDeclaration properties referenced in template excluding type `X` from package `Y`

```cypher
MATCH (c:ClassDeclaration)-[:HAS_TEMPLATE_BINDING]->(:Identifier)-[:HAS_ANCESTOR]->(p:PropertyDeclaration)
OPTIONAL MATCH (p)-[:HAS_DESCENDANT_TYPE_DECLARATION]->(t:TypeAliasDeclaration {name: 'X'})
WHERE t IS NULL OR NOT t.filePath CONTAINS 'Y'
RETURN c, p
LIMIT 50
```
