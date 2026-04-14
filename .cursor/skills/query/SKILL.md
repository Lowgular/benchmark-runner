# Query Skill

## Goal

Translate a natural language question into a Cypher query, run it, and return the result.

---

## Steps

### 1. Establish intent

Follow the skill: `../nl-to-intent/SKILL.md`

The output of this step is an intent sentence starting with `Find`.
Continue to Step 2 only after intent is stated.

---

### 2. Plan Cypher

Follow the skill: `../intent-to-cypher/SKILL.md`

The output of this step is a cypher query starting with `MATCH`
Continue to Step 3 only after cypher query is stated.

---

### 3. Run query

```bash
code-graph query '<cypher>'
```

**If successful** — go to step 4.

**If error** — read the error message, fix the query once, retry.

If error persists — stop and report:

- the intent
- the query attempted
- the exact error message

---

### 4. Return result

Return the raw query result to the master agent.
Do not summarise. Do not truncate. Do not reformat.
