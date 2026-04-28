# property-basic

## All properties

```cypher
MATCH (p:PropertyDeclaration|PropertySignature)
RETURN p
LIMIT 50
```

## Class properties

```cypher
MATCH (c:ClassDeclaration)-[:HAS_MEMBER]->(p:PropertyDeclaration)
RETURN c, p
LIMIT 50
```

## Interface or TypeAlias properties

```cypher
MATCH (decl:InterfaceDeclaration|TypeAliasDeclaration)-[:HAS_MEMBER]->(p:PropertySignature)
RETURN decl, p
LIMIT 50
```

## Class properties whose type resolves to name `X` from package `Y` (direct)

Use this first. Covers simple types: `HttpClient`, `Router`, `Store`, class or interface references.

```cypher
MATCH (c:ClassDeclaration)-[:HAS_MEMBER]->(p:PropertyDeclaration)
MATCH (p)-[:HAS_TYPE_DECLARATION]->(t:ClassDeclaration|TypeAliasDeclaration|InterfaceDeclaration {name: 'X'})
WHERE t.filePath CONTAINS 'Y'
RETURN c, p
LIMIT 50
```

### Multiple names

In case of multiple potential names e.g. when user asks for "name is one of the following", then you need to expand WHERE statement with IN operator:

```cypher
MATCH (c:ClassDeclaration)-[:HAS_MEMBER]->(p:PropertyDeclaration)
MATCH (p)-[:HAS_TYPE_DECLARATION]->(t:ClassDeclaration|TypeAliasDeclaration|InterfaceDeclaration)
WHERE t.filePath CONTAINS 'Y' AND t.name IN ['X', 'Y', 'Z']
RETURN c, p
LIMIT 50
```

## Class properties whose type resolves to name `X` from package `Y` (descendant — generic types only)

Use only when the type is generic: `Signal<T>`, `Observable<T>`, `WritableSignal<T>`.
If the direct variant returned empty, try this as fallback.

```cypher
MATCH (c:ClassDeclaration)-[:HAS_MEMBER]->(p:PropertyDeclaration)
MATCH (p)-[:HAS_DESCENDANT_TYPE_DECLARATION]->(t:ClassDeclaration|TypeAliasDeclaration|InterfaceDeclaration {name: 'X'})
WHERE t.filePath CONTAINS 'Y'
RETURN c, p
LIMIT 50
```

> Nodes introduced by a relationship must always carry a label.
> For package filtering use `WHERE t.filePath CONTAINS 'Y'` — not `HAS_SYMBOL_IMPORT`.
> `HAS_SYMBOL_IMPORT` is only valid on `Identifier` nodes.
