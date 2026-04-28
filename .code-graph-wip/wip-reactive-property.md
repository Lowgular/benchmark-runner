# Constraint: reactive-property

## Intent fragment

Narrow **`PropertyDeclaration`** on a class (start from **property** pattern: class field).

**Prefer the initializer**, then the type annotation, when classifying.

## How to load this or other constraints (backend-safe)

Catalog text may be served **without file paths**. Do **not** rely on markdown links to `.md` files.

**Standard:** **Search for `[<id>]`** by calling tool **`search_constraint_context`** with **`constraintKeywords`** containing the **exact catalog id** (one id per string, or several strings in one call).

Examples:

- **Search for `[reactive-property]`** (this document) — `search_constraint_context({ constraintKeywords: ["reactive-property"] })`
- **Search for `[signal-type]`** — `search_constraint_context({ constraintKeywords: ["signal-type"] })`
- **Search for `[observable-type]`** — `search_constraint_context({ constraintKeywords: ["observable-type"] })`
- Load multiple — `search_constraint_context({ constraintKeywords: ["signal-type", "observable-type"] })`

Aliases from the index still work as keywords, but **exact ids** are preferred when you need a specific fragment.

## Abstract labels vs concrete kinds

**Reactive property** and **non-reactive property** are **planning labels**, not single AST node types. They summarize intent after you decide **how** the field behaves:

| Abstract label | Meaning here |
|----------------|----------------|
| **Reactive** | The field is **signal-oriented** or **RxJS-oriented** (see below). |
| **Non-reactive** | The field is **normal** — neither signal-oriented nor RxJS-oriented for this constraint. |

**Concrete implementation kinds** (what you actually check):

1. **Signal-oriented** — Angular signal APIs / `Signal` typing → **Search for `[signal-type]`** (tool call above).
2. **RxJS-oriented** — `Observable` / `Subject` / stream factories from **rxjs** → **Search for `[observable-type]`** (tool call above).
3. **Normal** — primitives, plain objects, arrays, static values, or anything that matches **neither** after applying **Search for `[signal-type]`** and **Search for `[observable-type]`** heuristics on that property.

So: **reactive** = (1) ∪ (2). **Non-reactive** = (3).

User wording may be abstract (**reactive**, **non-reactive**), specific (**signal**, **rxjs** / **observable** / **subject**), or negative (**not signal**, **not rxjs**, **plain**). Map those phrases to the table above, then **surface the final abstract label** (reactive vs non-reactive) plus the **concrete kind** (signal / observable / normal) when it matters for the next planning step.

## Plan forks

**Reactive (generic)** — signal-oriented **or** RxJS-oriented (user did not exclude either).

**Signal properties** — signal-oriented only; **Search for `[signal-type]`**.

**Rxjs / observable / subject properties** — RxJS-oriented only; **Search for `[observable-type]`**.

**Not signal** — complement of signal-oriented (includes RxJS and normal).

**Not rxjs** — complement of RxJS-oriented (includes signal and normal).

**Non-reactive / plain** — **non-reactive** label: normal only (exclude both signal-oriented and RxJS-oriented).

When the user is vague, pick the **smallest** matching fork above, then intersect with the rest of the task (class, template usage, etc.) in later steps.
