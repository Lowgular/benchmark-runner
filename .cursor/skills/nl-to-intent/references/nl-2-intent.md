# Natural Language to Intent Guide

## What This Guide Does

Users type queries in plain English. They do not know TypeScript AST node names. They may not mention Angular explicitly even when they mean Angular. Your job is to translate their input into a precise intent that can be embedded and matched against examples.

The output must follow the intent grammar defined in `intent.md`.

---

## The Translation Job

Three things happen during translation:

**1. Resolve domain concepts to AST node types**
The user says "class", you write `ClassDeclaration`. The user says "component", you write `ClassDeclaration that has decorator with firstIdentifier 'Component'`.

**2. Infer Angular context when implied**
The user will not say "from @angular/core". If they mention Angular concepts (component, service, module, directive, pipe, signal, inject) — Angular context is implied. Add the appropriate decorator or import constraint.

**3. Normalize to intent grammar**
Strip filler words. Apply `Find`, `that has`, `and also find`, `and optionally find`, `where`, `with` conjunctions. One sentence, no cypher syntax.

---

## TypeScript Concept Mapping

| User says                               | Intent writes                                        |
| --------------------------------------- | ---------------------------------------------------- |
| class, classes                          | `ClassDeclaration`                                   |
| interface, interfaces                   | `InterfaceDeclaration`                               |
| type, types, type alias                 | `TypeAliasDeclaration`                               |
| enum                                    | `EnumDeclaration`                                    |
| method, methods, function on class      | `MethodDeclaration`                                  |
| property, properties, field, fields     | `PropertyDeclaration`                                |
| getter                                  | `GetAccessor`                                        |
| setter                                  | `SetAccessor`                                        |
| constructor                             | `Constructor`                                        |
| constructor param, constructor argument | `Constructor that has parameter`                     |
| import, imports                         | `ImportDeclaration`                                  |
| decorator                               | `Decorator`                                          |
| identifier                              | `Identifier`                                         |
| arrow function, lambda                  | `ArrowFunction`                                      |
| return, return value                    | `ReturnStatement`                                    |
| readonly                                | `that has modifier ReadonlyKeyword`                  |
| private                                 | `that has modifier PrivateKeyword`                   |
| static                                  | `that has modifier StaticKeyword`                    |
| abstract class                          | `ClassDeclaration that has modifier AbstractKeyword` |
| initialized with, assigned to           | `that has initializer`                               |
| calls, invokes                          | `CallExpression`                                     |
| accesses property                       | `PropertyAccessExpression`                           |

---

## Angular Concept Mapping

| User says                 | Intent writes                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| component, components     | `ClassDeclaration that has decorator with firstIdentifier 'Component'`                                        |
| directive, directives     | `ClassDeclaration that has decorator with firstIdentifier 'Directive'`                                        |
| pipe, pipes               | `ClassDeclaration that has decorator with firstIdentifier 'Pipe'`                                             |
| service, services         | `ClassDeclaration that has decorator with firstIdentifier 'Injectable'`                                       |
| module, ng module         | `ClassDeclaration that has decorator with firstIdentifier 'NgModule'`                                         |
| injectable                | `ClassDeclaration that has decorator with firstIdentifier 'Injectable'`                                       |
| signal, signals           | `PropertyDeclaration that has initializer CallExpression that has expression Identifier with text 'signal'`   |
| computed                  | `PropertyDeclaration that has initializer CallExpression that has expression Identifier with text 'computed'` |
| input signal              | `PropertyDeclaration that has initializer CallExpression that has expression Identifier with text 'input'`    |
| output signal             | `PropertyDeclaration that has initializer CallExpression that has expression Identifier with text 'output'`   |
| inject(), inject function | `PropertyDeclaration that has initializer CallExpression that has expression Identifier with text 'inject'`   |
| DI, dependency injection  | constructor parameters OR inject() properties — include both with `and optionally find`                       |
| standalone                | `that has descendant ObjectLiteralExpression that has property with name 'standalone'`                        |
| providedIn                | `that has descendant ObjectLiteralExpression that has property with name 'providedIn'`                        |
| changeDetection           | `that has descendant ObjectLiteralExpression that has property with name 'changeDetection'`                   |
| template                  | `that has descendant PropertyAssignment with name 'template'`                                                 |
| templateUrl               | `that has descendant PropertyAssignment with name 'templateUrl'`                                              |
| selector                  | `that has descendant ObjectLiteralExpression that has property with name 'selector'`                          |
| declarations array        | `that has descendant ObjectLiteralExpression that has property with name 'declarations'`                      |
| imports array             | `that has descendant ObjectLiteralExpression that has property with name 'imports'`                           |
| exports array             | `that has descendant ObjectLiteralExpression that has property with name 'exports'`                           |
| providers array           | `that has descendant ObjectLiteralExpression that has property with name 'providers'`                         |

---

## Inference Rules

### Angular context is implied — do not require the user to say it

If the user mentions any Angular concept, add the Angular constraint automatically:

```
"find all services"
→ Find ClassDeclaration that has decorator with firstIdentifier 'Injectable'

NOT → Find ClassDeclaration
```

### "all" means no filter — omit it from intent

```
"get all classes"
→ Find ClassDeclaration

NOT → Find all ClassDeclaration
```

### Negation — "without", "missing", "no X", "lacking"

Negation maps to an optional join — not to a `without` keyword which does not exist in intent grammar.

"services without providedIn"
→ Find ClassDeclaration that has decorator with firstIdentifier 'Injectable'
and optionally find this decorator that has descendant ObjectLiteralExpression
that has property with name 'providedIn'

The consumer filters for null optional results to find the "without" cases.

### Containment Verbs

When the user uses a verb that implies membership inside a decorator property, map it to the corresponding property traversal with a correlated reference.

| Verb                    | Property       | Applies to                                        |
| ----------------------- | -------------- | ------------------------------------------------- |
| declared in             | `declarations` | NgModule only                                     |
| imported in / imports   | `imports`      | NgModule, standalone Component / Directive / Pipe |
| exported from / exports | `exports`      | NgModule only                                     |
| provided in / provides  | `providers`    | NgModule, Component, Directive                    |

#### Pattern

```
"X [verb] in/from Y"
→ Find [X node] and optionally find [Y decorator] that has descendant ObjectLiteralExpression
  that has property with name '[property]' that has initializer ArrayLiteralExpression
  that has element Identifier with text matching this [X] name
```

#### Examples

```
"ng modules imported in another ng module"
→ Find ClassDeclaration that has decorator with firstIdentifier 'NgModule'
  and optionally find Decorator that has descendant ObjectLiteralExpression
  that has property with name 'imports' that has initializer ArrayLiteralExpression
  that has element Identifier with text matching this ClassDeclaration name

"components declared in a module"
→ Find ClassDeclaration that has decorator with firstIdentifier 'Component'
  and optionally find Decorator that has descendant ObjectLiteralExpression
  that has property with name 'declarations' that has initializer ArrayLiteralExpression
  that has element Identifier with text matching this ClassDeclaration name

"components exported from a module"
→ Find ClassDeclaration that has decorator with firstIdentifier 'Component'
  and optionally find Decorator that has descendant ObjectLiteralExpression
  that has property with name 'exports' that has initializer ArrayLiteralExpression
  that has element Identifier with text matching this ClassDeclaration name
```

Note: `exported` and `declared` always mean NgModule. `imported` and `provided` can mean NgModule or standalone class depending on context — if second noun is a module use NgModule, otherwise use the appropriate standalone decorator.

### Possession maps to traversal

```
"classes with their methods"       → and also find ... MethodDeclaration
"components and their templates"   → and optionally find ... PropertyAssignment with name 'templateUrl'
"services and whether they have providedIn" → and optionally find ...
```

"with their" → `and also find` (required)
"and whether they have" → `and optionally find` (optional, absence is meaningful)

### Filtering words map to `where` or `with`

```
"named Foo"              → with name 'Foo'
"whose name starts with" → where name starts with '...'
"containing Model"       → where name contains 'Model'
"ending in Service"      → where name ends with 'Service'
"called subscribe"       → with name 'subscribe'
```

### Vague Angular terms — use narrowest interpretation

```
"standalone things"      → ClassDeclaration that has decorator ... (Component or Directive or Pipe)
"decorated classes"      → ClassDeclaration that has decorator
"Angular classes"        → ClassDeclaration that has decorator with firstIdentifier is ['Component', 'Directive', 'Pipe', 'Injectable']
"Angular decorators"     → Decorator with firstIdentifier is ['Component', 'Directive', 'Pipe', 'Injectable', 'NgModule']
```

---

## Step by Step

1. **Identify the primary subject** — what is the user looking for? Map it to an AST node type.
2. **Identify Angular context** — are any Angular concepts mentioned or implied? Add decorator constraints.
3. **Identify joins** — does the user want related data? Map possession/relation words to `and also find` or `and optionally find`.
4. **Identify filters** — are there name, value, or property constraints? Map to `with` or `where`.
5. **Write one intent sentence** — `Find <Node> ...` following intent grammar.

---

## Examples

### No Angular context

```
User: "get me all the classes that have readonly properties"
Step 1: primary = ClassDeclaration
Step 2: no Angular
Step 3: join = readonly properties → PropertyDeclaration that has modifier ReadonlyKeyword
Step 4: no filters

Intent: Find ClassDeclaration that has member PropertyDeclaration that has modifier ReadonlyKeyword
```

---

### Angular implied

```
User: "show me all components"
Step 1: primary = ClassDeclaration
Step 2: Angular implied by "components" → decorator with firstIdentifier 'Component'
Step 3: no joins
Step 4: no filters

Intent: Find ClassDeclaration that has decorator with firstIdentifier 'Component'
```

---

### Angular with optional join

```
User: "find services and check if they use providedIn root"
Step 1: primary = ClassDeclaration
Step 2: Angular implied by "services" → Injectable decorator
Step 3: optional join — "check if" → and optionally find
Step 4: filter — "providedIn root" → property with name 'providedIn'

Intent: Find ClassDeclaration that has decorator with firstIdentifier 'Injectable' that has descendant ObjectLiteralExpression and optionally find this ObjectLiteralExpression that has property with name 'providedIn'
```

---

### No Angular, name filter

```
User: "get type aliases that have Model in their name"
Step 1: primary = TypeAliasDeclaration
Step 2: no Angular
Step 3: no joins
Step 4: filter — "have Model in their name" → where name contains 'Model'

Intent: Find TypeAliasDeclaration where name contains 'Model'
```

---

### Angular DI audit

```
User: "which angular classes still use constructor injection"
Step 1: primary = ClassDeclaration
Step 2: Angular implied — decorated classes
Step 3: join — constructor params → that has member Constructor that has parameter
Step 4: no filters

Intent: Find ClassDeclaration that has decorator with firstIdentifier is ['Component', 'Directive', 'Pipe', 'Injectable'] that has member Constructor that has parameter
```

---

### Vague but inferrable

```
User: "find everything that subscribes"
Step 1: primary = PropertyAccessExpression
Step 2: no Angular
Step 3: no joins
Step 4: filter — "subscribes" → with name 'subscribe'

Intent: Find PropertyAccessExpression with name 'subscribe'
```

---

## When Input is Ambiguous

If two interpretations are equally valid, pick the narrowest one and note the assumption briefly so the user can correct it:

```
User: "find signals"

Could mean:
- signal() properties (Angular signals)
- any property named 'signal'

Narrowest: Angular signals
Intent: Find PropertyDeclaration that has initializer CallExpression that has expression Identifier with text 'signal'
```

Do not ask for clarification on every ambiguous input — make a reasonable choice and proceed.
