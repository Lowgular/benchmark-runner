# code-graph TypeScript graph schema (reference)

**Purpose:** Describes node labels, relationships, and common properties for queries over the TypeScript AST graph. This is **reference material**, not a skill or agent workflow.

**Related**

- Cypher dialect and limits: `./syntax.md`
- Execution: `code-graph query "<cypher>"` from the workspace root

---

## Graph model

The graph is derived from **TypeScript source** (AST + TypeChecker where applicable), driven by the project tsconfig used with the engine.

- **Nodes** — AST nodes; label names match **SyntaxKind** (e.g. `ClassDeclaration`, `MethodDeclaration`, `Decorator`).
- **Relationships** — Structural, symbolic, or heritage edges (see tables below).
- **Labels** — PascalCase SyntaxKind names, not shortened names like `Method` or `Class`.

---

## Node properties (typical)

Not every node exposes every field; availability depends on node kind and extraction.

| Property          | Description                                                               |
| ----------------- | ------------------------------------------------------------------------- |
| `id`              | Stable id: `src/app/app.component.ts:1:2.3.4` (file + position)           |
| `labels`          | Array holding the node’s SyntaxKind label                                 |
| `name`            | From `node.name?.getText()` where applicable (class, method, property, …) |
| `filePath`        | Source file path                                                          |
| `text`            | Full source text of the AST span                                          |
| `loc`             | Lines of code spanned by the node                                         |
| `type`            | Resolved type string when TypeChecker provides it                         |
| `moduleSpecifier` | On `ImportDeclaration`: module string (e.g. `@angular/core`)              |
| `firstIdentifier` | Text of the first descendant `Identifier` (e.g. decorator name)           |
| `initializer`     | Initializer text when present                                             |

**Property extraction (performance):**

- `id` and `labels` are always present.
- `name` and `filePath` are extracted by default.
- Other properties (`text`, `loc`, `type`, `firstIdentifier`, `initializer`, `moduleSpecifier`, …) may be **absent** unless referenced by the query via:
- `var.prop` (e.g. `RETURN d.firstIdentifier`, `WHERE d.firstIdentifier = 'NgModule'`)
- inline node maps (e.g. `(id:Identifier { text: 'NgModule' })`).

---

## Relationships

### Traversal

| Relationship     | Meaning                            |
| ---------------- | ---------------------------------- |
| `HAS_DESCENDANT` | Recursive descent into child nodes |
| `HAS_ANCESTOR`   | Recursive ascent to parent nodes   |

### Direct AST structure

| Relationship          | Source → Target                                                          |
| --------------------- | ------------------------------------------------------------------------ |
| `HAS_MEMBER`          | Class/interface → members                                                |
| `HAS_PARAMETER`       | Function/constructor → parameters                                        |
| `HAS_DECORATOR`       | Class/method/property → decorators                                       |
| `HAS_MODIFIER`        | Node → modifiers (`readonly`, `private`, …)                              |
| `HAS_ARGUMENT`        | CallExpression/NewExpression → arguments                                 |
| `HAS_INITIALIZER`     | VariableDeclaration/PropertyDeclaration → initializer                    |
| `HAS_EXPRESSION`      | CallExpression/Decorator → expression                                    |
| `HAS_TYPE_ANNOTATION` | Parameter/property/return → explicit type                                |
| `HAS_BODY`            | Function/method/arrow → body                                             |
| `HAS_PROPERTY`        | ObjectLiteralExpression → property assignments                           |
| `HAS_ELEMENT`         | ArrayLiteralExpression → direct elements (Identifier, CallExpression, …) |
| `HAS_NAME`            | Node → `Identifier` (name)                                               |
| `HAS_TYPE`            | Node → resolved type (TypeChecker)                                       |

### Symbol resolution (TypeChecker)

| Relationship             | Meaning                                                  |
| ------------------------ | -------------------------------------------------------- |
| `HAS_SYMBOL_DECLARATION` | Identifier → declaration node(s) the symbol resolves to  |
| `HAS_SYMBOL_IMPORT`      | Identifier → `ImportDeclaration`(s) for imported symbols |
| `HAS_TYPE_DECLARATION`   | TypeReferenceNode → declaration node(s) for the type     |

### Heritage

| Relationship | Meaning                         |
| ------------ | ------------------------------- |
| `EXTENDS`    | Class/interface → extended type |
| `IMPLEMENTS` | Class → implemented interfaces  |

---

## Example queries (illustrative)

**`ClassDeclaration` with `@Component`-style decorator (`firstIdentifier`)**

```cypher
MATCH (c:ClassDeclaration)-[:HAS_DECORATOR]->(d:Decorator {firstIdentifier: 'Component'})
RETURN c.id, c.name, c.filePath
LIMIT 10
```

**Methods and parameters**

```cypher
MATCH (m:MethodDeclaration)-[:HAS_PARAMETER]->(p:ParameterDeclaration)
RETURN m.name, p.name
LIMIT 10
```

**Import path for a symbol name**

```cypher
MATCH (i:Identifier {name: 'MyService'})-[:HAS_SYMBOL_IMPORT]->(imp:ImportDeclaration)
RETURN i.name, imp.moduleSpecifier
LIMIT 10
```

**Private Readonly properties**

```cypher
MATCH (p:PropertyDeclaration)-[:HAS_MODIFIER]->(:ReadonlyKeyword)
MATCH (p)-[:HAS_MODIFIER]->(:PrivateKeyword)
RETURN p.id, p.name
LIMIT 10
```

---

## Typical patterns (lookup)

| Question                | Pattern                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| Interfaces              | `MATCH (n:InterfaceDeclaration) RETURN n.id, n.name LIMIT 10`           |
| Decorated class         | `HAS_DECORATOR` + `WHERE d.firstIdentifier = 'Injectable'` (or similar) |
| Inheritance             | `EXTENDS`                                                               |
| Symbol / import tracing | `HAS_SYMBOL_DECLARATION`, `HAS_SYMBOL_IMPORT`                           |
| Class members           | `HAS_MEMBER`                                                            |

---

## Notes

- **Labels** — Use exact SyntaxKind strings (e.g. `MethodDeclaration`), not informal names (`Method`, `Class`).
- **`HAS_DESCENDANT` / `HAS_ANCESTOR`** — Flexible but costly; narrow with specific labels in `MATCH` where possible.
- **`HAS_SYMBOL_DECLARATION`** — Resolution can cross files, including under `node_modules`.
- **Decorators** — Name is usually exposed via **`firstIdentifier`**, not `d.name`, for filters like `Component` / `NgModule`.
- **Payload** — Returning `n.id`, `n.name` (and selected fields) is smaller than returning full node blobs.

---

## Changelog

### 2026-03-24

- Reframed as schema reference only; removed skill frontmatter and workflow-style sections.
