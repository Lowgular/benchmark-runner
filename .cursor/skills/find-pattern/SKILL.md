---
name: find-pattern
description: Finds curated design patterns by natural-language, resolves which patterns match the user, fetches example Cypher queries and runs them, then returns a list of found nodes. Use when the user asks for patterns by name, wants to browse or find code structures.
---

# Find pattern

## Goal

Resolve a **natural-language request** to **catalogued design patterns**, then return **structured results** — usually a **list** of showing the found file paths and node names.

## When to use

- User asks for design patterns **by patternId** in natural language.
- You need to show **which catalog entries** apply and **fetch** them with `code-graph query`.

## Catalog and pattern ids

Patterns live in `.code-graph/patterns/index.json`. It is a collection of following structure:

```json
{
  "patternId": "<pattern name using dot notation>",
  "cypher": "<query used to find this pattern in code>"
}
```

## Steps

### 1. Get the list of pattern ids

Load `.code-graph/patterns/index.json` to be aware of the list of supported `patternId`.

### 2. Match the user query to patterns

From the user’s natural-language request, extract the relevant `patternId` and its `cypher` query.

Important: user should provide a single `patternId` but if you see multiple, decide on the most relevant one.

Important: if you did not find any relevant entry. Stop the workflow and inform the user that the relevant pattern could not be found and if there are some semanticaly close patterns - propose them to the user.

### 3. Run `code-graph query`

Use extracted `cypher` query and call the bash cli tool (DO NOT CHANGE ANYTHING use it exactly as it is there):

```bash
code-graph query '<cypher>'
```

This will return json with the nodes that have `filePath` and `name` properties.

### 5. Output to the user

Return a **normal list**, one block per result, for example:

- **`name`** in **`filePath`**

Finish with a quick summary showing total results found

Do not merge unrelated patterns into one blob unless the user asked for a summary.
