# Intent to Cypher Skill

## Setup

Read the following before starting:

- `./references/schema.md`
- `./references/syntax.md`

Search for proven patterns close to the intent:

```bash
code-graph examples --type cypher "<intent>"
```

## Task

You will receive an intent sentence starting with `Find`.

Translate it into a Cypher query following these rules:

- Use the examples retrieved as patterns — do not invent relationship names
- Use exact node labels from `./references/schema.md`
- Use exact relationship names from the examples and `./references/syntax.md`
- Apply constraints from `./references/syntax.md`
- Name variables you will reuse in a second MATCH or OPTIONAL MATCH

## Output

State before continuing:

> Cypher: MATCH ...
