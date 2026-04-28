# variable-length-chain

## Path between internal nodes

```cypher
MATCH path = (c1:ClassDeclaration)-[:RELATIONSHIP*..20]->(c2:ClassDeclaration)
WHERE c1.id != c2.id
AND NOT c1.filePath CONTAINS 'node_modules'
AND NOT c2.filePath CONTAINS 'node_modules'
RETURN c1.name, c2.name, length(path) as hops
LIMIT 50
```

## Depth variants — replace `*..20` with:

| Intent            | Syntax                                                           |
| ----------------- | ---------------------------------------------------------------- |
| up to N           | `*..N`                                                           |
| at least N        | `*N..`                                                           |
| between N and M   | `*N..M`                                                          |
| exactly N         | `*N..N`                                                          |
| deepest per start | use `MAX(length(path)) as maxHops`, remove `c2.name` from RETURN |

> Always omit lower bound when possible — `*..N` not `*2..N`.
> Use `path =` to assign path variable. Use `length(path)` for hop count.
> Swap `ClassDeclaration` for any node label to traverse other node types.
> `node_modules` filter on endpoints only — traversal can pass through external nodes.
