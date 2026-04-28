# Pattern: dependency-chain

## Intent

Find class dependency chains.

A dependency chain means:

- `ClassDeclaration`
  - depends on another `ClassDeclaration`

### Depth variants:

By default you should assume direct dependencies (A depends on B)

But in some cases you need to map the depth:

- "longest" / "deepest" → `MAX` chain depth per starting class
- "at least N" → chain depth >= N
- "at most N" → chain depth <= N
- "between N and M" → chain depth >= N and <= M
- "exactly N" → chain depth = N

### Scope:

- internal only → exclude `node_modules` from both endpoints
- include external → remove `node_modules` filter
