# Constraint: observable-type

## Intent fragment

Recognize **RxJS stream** construction or typing on a class **property** (`PropertyDeclaration`). Compose with **property** and **reactive-property** when the user mentions observable, subject, rxjs, or stream-style APIs.

**Prefer the initializer**, then the type annotation.

## Heuristics (planning)

- **Stream types** — type annotation or dominant type references **`Observable`**, **`Subject`**, **`BehaviorSubject`**, **`ReplaySubject`**, **`AsyncSubject`**, or other stream types whose declarations come from a module specifier containing **`rxjs`** (including common subpaths).
- **Stream factories in initializer** — e.g. **`new BehaviorSubject(…)`**, **`new Subject()`**, **`of(…)`**, **`from(…)`**, **`interval(…)`**, or expression trees whose callee / return type resolves to **`Observable`** or **`Subject`**.

## Negative check

If neither the initializer nor the visible type surface shows RxJS stream shapes, the property is **not** in the RxJS bucket for this constraint (it may still match signal-type or be normal — **Search for `[signal-type]`** and **Search for `[reactive-property]`** via `search_constraint_context`).

## Related constraints (backend-safe)

- **Search for `[signal-type]`** — `search_constraint_context({ constraintKeywords: ["signal-type"] })`
- **Search for `[reactive-property]`** — `search_constraint_context({ constraintKeywords: ["reactive-property"] })`
