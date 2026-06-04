# Coding Conventions

**Analysis Date:** 2026-06-04

## Naming Patterns

**Files:**
- TypeScript source files: `kebab-case.ts` in harness and eval-runner (`framework.ts`, `tool-format.ts`, `write-summary.ts`, `node-match.utils.ts`)
- Metric files follow the `<name>.metric.ts` suffix pattern: `precision.metric.ts`, `recall.metric.ts`
- Angular components use `<name>.component.ts` / `<name>.component.html` / `<name>.component.scss`
- Angular services use `<name>.service.ts`
- Angular entity files use `<name>.entity.ts`
- Angular model/type files use `<name>.model.ts`, `<name>.ts`
- Angular DTO files use `<name>.dto.ts` under `dto/` subdirectories
- Angular UI state files use `<name>.ui-state.ts`
- Angular stories files use `<name>.stories.ts`
- Shell scripts: `run_task.sh` (kebab-case with `.sh` extension)

**Functions and Variables:**
- camelCase for all functions and variables (both harness and eval-runner)
- Functions are lowercase camelCase: `parseArgs`, `resolveModel`, `logMessage`, `normalizeNode`, `readLastResult`
- Constants at module level: UPPER_SNAKE_CASE for fixed lookup tables (`MODEL_ALIASES`, `PLAN_AND_FIND_TOOL_IDS`), camelCase for runtime values
- Private class fields in Angular: camelCase, declared with `private readonly` when possible

**Types and Interfaces:**
- `PascalCase` for all interfaces, types, classes, and enums
- Discriminated union members use single-letter tag field: `{ t: "user" | "assistant" | ... }` (see `Message` type in `harness/framework.ts`)
- Exported types use `export type` syntax (not `export interface`) in harness code
- NestJS DTOs and entities use classes with decorators

**Angular Specifics:**
- Component selectors: `app-<kebab-name>` (e.g., `app-teams-page`)
- Inject pattern: use `inject()` function (not constructor injection) in standalone components — see `TeamsPageComponent` and `TeamsService`
- NestJS API layer still uses constructor injection: `constructor(private readonly teamsService: TeamsService) {}`

## Code Style

**Formatting:**
- Prettier is used in the `angular-nest-team-crud` init state: `{ "singleQuote": true }`
- Harness TypeScript files use double quotes consistently
- Angular/NestJS init states use single quotes (enforced by Prettier config)
- Trailing commas present in multi-line function arguments and object literals
- 2-space indentation throughout TypeScript

**TypeScript Strictness:**
- Harness `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`, `verbatimModuleSyntax: true`, `isolatedModules: true`
- Eval-runner `tsconfig.json`: `strict: true`, `forceConsistentCasingInFileNames: true`
- Non-null assertions (`!`) used on TypeScript class fields to satisfy strict mode: `id!: number`, `name!: string`

**Linting:**
- ESLint with `@nx/eslint-plugin` in the `angular-nest-team-crud` init state
- `@nx/enforce-module-boundaries` rule enforced
- No custom ESLint rules in the harness/eval-runner packages (no config found at root level)

## Import Organization

**Order (harness/eval-runner):**
1. Node built-ins with `node:` prefix: `import { readFileSync } from "node:fs"`
2. Third-party packages
3. Internal project imports via relative paths

**Order (Angular/NestJS init states):**
1. `@angular/*` / `@nestjs/*` framework imports
2. Third-party packages (rxjs, typeorm, class-validator)
3. Local relative imports

**Path Aliases:**
- No custom `@/` aliases detected; imports use relative paths throughout (`../../framework.ts`, `./types.js`)
- Eval-runner uses `.js` extensions on relative imports for CommonJS compatibility: `import { NodeMatch } from "../types.js"`

**Module System:**
- Harness: ESM (`"type": "module"`, `"module": "NodeNext"`, `.ts` extensions in imports allowed via Bun)
- Eval-runner: CommonJS (`"type": "commonjs"`, standard Node module resolution, `.js` extensions required)
- Angular init states: Standard Angular module/ESM

## Error Handling

**Patterns:**

- Framework-level: throw `Error` objects with descriptive messages at validation boundaries, then catch in `main()` with `process.exit(1)`:
  ```typescript
  if (!existsSync(agentAbs)) throw new Error(`Agent file not found: ${agentAbs}`);
  // ...
  main().catch((err: unknown) => {
    console.error("Framework failed:", err);
    process.exit(1);
  });
  ```

- Harness generators: yield `{ t: "error", message }` events rather than throwing, allowing the framework to log and continue:
  ```typescript
  } catch (err) {
    status = "error";
    yield {
      t: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
  ```

- Unknown error coercion: always check `instanceof Error` before `.message`, else `String(err)`:
  ```typescript
  err instanceof Error ? err.message : String(err)
  ```

- `finally` for resource cleanup in generators (`toolset.close()`, `mcpClient.close()`)

- NestJS services throw `NotFoundException` from `@nestjs/common` for missing resources

- Angular components set `this.errorMessage` string from Observable `.error` callbacks (no global error handler)

## Logging

**Framework:** `console.error` for operational/diagnostic output to stderr, `console.log` for structured output to stdout

**Patterns:**
- Framework uses ANSI color codes via the `C` helper in `harness/tool-format.ts` — conditionally enabled only when `process.stdout.isTTY` is true
- Operational messages go to `stderr` to not pollute stdout data pipeline: `console.error(`harness: ${args.harness}`)`
- Eval-runner diagnostic messages: `console.log` (no color)
- task-runner messages: `console.log` with plain text prefixes

## Comments

**When to Comment:**
- Module-level JSDoc block comments used consistently at the top of each harness implementation to describe purpose, dependencies, and env requirements
- Inline comments used for non-obvious branching logic or SDK quirks
- Private method doc comments used for contract explanation: `/** Links existing rows by name or creates new MemberEntity rows — internal persistence only. */`

**JSDoc/TSDoc:**
- Block comment at top of most harness files (`/** ... */` style) describing the file's role
- No `@param`/`@returns` annotations — comments are narrative prose
- Type annotations carry the contract; comments add context about "why"

## Function Design

**Size:** Functions are small and single-purpose; most harness utility functions are under 20 lines

**Parameters:** Prefer named input objects for multi-parameter functions:
```typescript
function buildAssessments(input: {
  expected: NodeMatch[];
  actual: NodeMatch[];
}): AssessmentResult[]
```

**Return Values:**
- Generators return `AsyncGenerator<Message>` — never throw from within, always yield error events
- Pure utility functions return the computed value directly
- Void functions declared with `: void` return type

## Module Design

**Exports:**
- Each harness exports a single `run` function as named export: `export async function* run(params: HarnessParams): AsyncGenerator<Message>`
- Eval-runner rating modules export named constants (e.g., `precisionMetric`, `recallMetric`)
- Shared types and interfaces are exported from dedicated type files (`types.ts`, `rating-types.ts`)

**Barrel Files:**
- `eval-runner/src/ratings/per-build/index.ts` used as barrel for per-build rating aggregation
- No barrel `index.ts` files in harness packages — direct file imports used

---

*Convention analysis: 2026-06-04*
