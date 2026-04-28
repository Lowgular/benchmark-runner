# method-calls-property

## Method that references a member property named `X`

```cypher
MATCH (c:ClassDeclaration)-[:HAS_MEMBER]->(m:MethodDeclaration)
MATCH (c)-[:HAS_MEMBER]->(p:PropertyDeclaration {name: 'X'})
MATCH (m)-[:HAS_DESCENDANT]->(pae:PropertyAccessExpression {name: p.name})
RETURN c, m, p
LIMIT 50
```

## Method that returns result of calling a member property named `X`

```cypher
MATCH (c:ClassDeclaration)-[:HAS_MEMBER]->(m:MethodDeclaration)
MATCH (c)-[:HAS_MEMBER]->(p:PropertyDeclaration {name: 'X'})
MATCH (m)-[:HAS_DESCENDANT]->(ret:ReturnStatement)
MATCH (m)-[:HAS_DESCENDANT]->(pae:PropertyAccessExpression {name: p.name})
RETURN c, m, p, ret
LIMIT 50
```

## Class with decorator `X` from package `Y` whose method references a member property of type `Z` from package `W`

```cypher
MATCH (c:ClassDeclaration)-[:HAS_DECORATOR]->(d:Decorator)-[:HAS_DESCENDANT]->(id:Identifier {text: 'X'})-[:HAS_SYMBOL_IMPORT]->(imp:ImportDeclaration {moduleSpecifier: 'Y'})
MATCH (c)-[:HAS_MEMBER]->(p:PropertyDeclaration)-[:HAS_TYPE_DECLARATION]->(t:ClassDeclaration|TypeAliasDeclaration|InterfaceDeclaration {name: 'Z'})
WHERE t.filePath CONTAINS 'W'
MATCH (c)-[:HAS_MEMBER]->(m:MethodDeclaration)
MATCH (m)-[:HAS_DESCENDANT]->(pae:PropertyAccessExpression {name: p.name})
RETURN DISTINCT c.name, c.filePath
LIMIT 50
```
