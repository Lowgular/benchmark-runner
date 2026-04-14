# code-graph Cypher dialect (reference)

**Purpose:** Describes the Cypher subset and limits of the code-graph query engine. This is **reference material** (facts and constraints), not a skill or step-by-step agent workflow.

**Related**

- Node labels and relationships: `./schema.md`
- Execution: `code-graph query "<cypher>"` from the workspace root.

---

## MATCH

- Basic node: `(n:Label)`
- Property filter: `(n:Label { prop: 'value' })`
- Relationship: `(a)-[:REL]->(b)`
- Incoming: `(a)<-[:REL]-(b)`
- Variable-length path: `(a)-[*]->(b)` — only bare `*`; forms like `*1..3`, `*2..`, `*..3` are not supported
- Multiple labels (AND): `(n:Label1:Label2)`
- Multiple labels (OR): `(n:Label1|Label2)`
- Multiple rel types: `(a)-[:REL1|REL2]->(b)`
- `OPTIONAL MATCH` — left-outer style joins

**Correlated `MATCH`:** A second `MATCH` runs per row from the first and merges on shared variable names (same node id). In the **first** `MATCH`, bind **named** variables for nodes reused later; anonymous nodes in the middle (e.g. `(:Identifier {text: 'NgModule'})` instead of `(id:Identifier …)`) can prevent the second pattern from lining up and yield empty results.

```cypher
MATCH (c:ClassDeclaration)-[:HAS_DECORATOR]->(d:Decorator)
  -[:HAS_EXPRESSION]->(call:CallExpression)-[:HAS_EXPRESSION]->(id:Identifier {text: 'NgModule'})
  -[:HAS_SYMBOL_IMPORT]->(decl:ImportDeclaration {moduleSpecifier: '@angular/core'})
MATCH (d)-[:HAS_EXPRESSION]->(:CallExpression)-[:HAS_ARGUMENT]->(:ObjectLiteralExpression)
  -[:HAS_PROPERTY]->(prop:PropertyAssignment {name: 'declarations'})-[:HAS_INITIALIZER]->(arr:ArrayLiteralExpression)
WHERE arr.text = '[]'
RETURN c.id, c.name, arr.text
LIMIT 20
```

---

## Agent guidance: filters and performance

When planning queries for this engine, **push equality filters into the node pattern** whenever the condition is a simple literal `=` on that node’s flat properties:

- **Prefer** `(n:ClassDeclaration { name: 'AppModule' })` over `MATCH (n:ClassDeclaration) WHERE n.name = 'AppModule'`.
- **Prefer** `(id:Identifier { text: 'NgModule' })` and `(imp:ImportDeclaration { moduleSpecifier: '@angular/core' })` in the `MATCH` path over separate `WHERE` lines for the same checks.

**Use `WHERE` (or additional `WHERE` conjuncts) when you must**, for example:

- **`IN` / `NOT IN`** (including “one of several literals” on a property)
- **Comparisons** (`>`, `<`, `>=`, `<=`)
- **String patterns** (`STARTS WITH`, `ENDS WITH`, `CONTAINS`) or **regex** (`=~`)
- **Null checks** (`IS NULL`, `IS NOT NULL`)
- **Cross-variable conditions** (e.g. comparing one bound node’s property to another’s)
- **Boolean combinations** you cannot express as a single inline map (mixed `AND` / `OR` / `NOT` / parentheses — supported in one `WHERE`)

**Why it matters:** Extra `WHERE` stages and large boolean trees can increase work during matching on big graphs. Fewer, tighter patterns (properties on nodes in `MATCH`) tend to shrink the candidate set earlier and keep queries easier to read.

Avoid piling on many independent `WHERE` predicates when several of them could be **one** inline map on the same node, e.g. `(prop:PropertyAssignment { name: 'declarations' })` rather than `MATCH … WHERE prop.name = 'declarations'`.

---

## WHERE

- Equality / inequality: `=`, `!=`
- Comparison: `>`, `<`, `>=`, `<=`
- `IN` / `NOT IN`
- Null: `IS NULL`, `IS NOT NULL`
- Strings: `STARTS WITH`, `ENDS WITH`, `CONTAINS`
- Regex: `WHERE n.prop =~ 'pattern'` — the `MATCHES` keyword is not this dialect
- Boolean composition: `AND`, `OR`, `XOR`, `NOT`, and parentheses in **one** `WHERE` clause are supported (see **Agent guidance** above — still prefer inline `{ prop: value }` on nodes for plain equality).

---

## RETURN

- **Aggregates:** `COUNT(*)`, `COUNT(n)`, `COUNT(n.prop)`, `COLLECT` / `AVG` / `SUM` / `MIN` / `MAX` on `n` or `n.prop` (no `*` except `COUNT`); optional `AS name`. Non-aggregate columns define the group key. **`AVG` / `SUM`:** numeric samples only (same rules); empty → `null`. **`MIN`/`MAX`:** skip nulls; empty → `null`; order: graph nodes by `id`, else numeric if both coerce, else string `localeCompare`.
- Variables: `RETURN n, m`
- Properties: `RETURN n.id`, `RETURN n.name`, `RETURN n.labels` (as supported on stored nodes)
- Relationship fields: `RETURN r.source`, `RETURN r.target`, `RETURN r.type`
- `RETURN *`
- Aliases: `RETURN n AS node`
- `RETURN DISTINCT …`
- Inline limit: `RETURN n LIMIT 10`

`RETURN` is **required** for every query.

---

## ORDER BY

- `ORDER BY n.name`, `ASC` / `DESC`
- Multiple: `ORDER BY n.type DESC, n.name ASC`

---

## Graph model constraints

- Node properties are flat; values are primitives (no nested object paths in property access).
- Relationships do not carry arbitrary properties in filters; edges expose `source`, `target`, `type` where applicable.

---

## Dialect gotchas (vs “full” Cypher)

**What this is:** Short list of mismatches between **generic Cypher / Neo4j habits** and **this engine**. Models often hallucinate Neo4j features; these are the usual failure modes.

| Trap                                                                | What goes wrong                                                                                | What to do instead                                                                                      |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **`MATCH n` without parentheses**                                   | Parse error (`Expected LPAREN`)                                                                | Always `MATCH (n)` or `MATCH (n:ClassDeclaration)`                                                      |
| **Short labels (`Class`, `Method`)**                                | Often **zero rows** (label mismatch)                                                           | Use SyntaxKind labels from `./schema.md` (e.g. `ClassDeclaration`, `MethodDeclaration`)                 |
| **`RETURN labels(n)` or any `fn(...)` in `RETURN`**                 | Parse error — `RETURN` is only `var`, `var.prop`, `*`, aliases                                 | Use `RETURN n.labels` if you need the stored label array on the node                                    |
| **`size(...)` on strings or collections**                           | Often **unsupported operator**                                                                 | Compare `text` to literals, or use `STARTS WITH` / `ENDS WITH` / `CONTAINS` / `=~` on string properties |
| **`prop NOT CONTAINS 'x'`**                                         | **`NOT` in operator position only builds `NOT IN`** — parser then expects `IN`, not `CONTAINS` | Reframe (e.g. `OPTIONAL MATCH` + `IS NULL`, or post-filter in application code)                         |
| **`WHERE NOT ( ... )` pattern negation**                            | Rejected by validator                                                                          | `OPTIONAL MATCH` the positive pattern, then `WHERE relatedNode IS NULL`                                 |
| **`MATCHES`**                                                       | Not a keyword here                                                                             | Regex: `WHERE n.prop =~ 'pattern'`                                                                      |
| **`WITH` / `UNWIND` / `UNION`**                                     | Not supported                                                                                  | Multiple `MATCH` clauses; no `UNWIND`                                                                   |
| **`COUNT` / `COLLECT` / `AVG` / `SUM` / `MIN` / `MAX` in `RETURN`** | Supported with optional `AS alias`                                                             | Non-aggregate columns define the group key                                                              |
| **Many `WHERE` lines for simple `=` on one node**                   | Slower / noisier on large graphs                                                               | Put literals in the node pattern: `(n:Label { prop: 'x' })` (see **Agent guidance**)                     |

**Read-only:** `CREATE`, `MERGE`, `DELETE`, `SET`, `REMOVE` are not supported.

---

## Example queries (illustrative)

**Angular components / directives**

```cypher
MATCH (c:ClassDeclaration)-[:HAS_DECORATOR]->(d:Decorator)
WHERE d.firstIdentifier IN ['Component', 'Directive']
RETURN DISTINCT c.id, c.name
LIMIT 10
```

**Methods and parameters**

```cypher
MATCH (m:MethodDeclaration)-[:HAS_PARAMETER]->(p:ParameterDeclaration)
RETURN m.name, p.name
ORDER BY m.name ASC
LIMIT 10
```

**Import site for a symbol name**

```cypher
MATCH (i:Identifier { name: 'MyService' })-[:HAS_SYMBOL_IMPORT]->(imp:ImportDeclaration)
RETURN i.name, imp.moduleSpecifier
LIMIT 10
```

---

## Changelog

### 2026-03-24

- Reframed as dialect reference only; removed workflow / agent-instruction sections.
- Added **Dialect gotchas** (Neo4j-style traps vs this parser/validator).
- Documented **`COUNT` / `COLLECT` / `AVG` / `SUM` / `MIN` / `MAX` in `RETURN`** (engine support).

### 2026-03-25

- Added **Agent guidance: filters and performance** (prefer inline `{ prop: value }` for equality; when to use `WHERE`; avoid redundant multi-`WHERE` mess).
- Documented boolean `WHERE` composition (`AND` / `OR` / `NOT` / parentheses / `XOR`); removed stale “no mixed AND/OR” rule.

### 2026-03-05

- Property access in RETURN: `RETURN n.id`, `RETURN n.labels`, `RETURN r.source`

### 2026-01-28

- `RETURN DISTINCT` — deduplicates by returned variables' IDs
