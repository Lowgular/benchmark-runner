# Testing Patterns

**Analysis Date:** 2026-06-04

## Test Framework

**Overview:**
This repository contains multiple sub-projects with different testing setups. There are no tests in the harness or eval-runner packages themselves — testing infrastructure exists only in the Angular/NestJS init states and the visual regression (VRT) system.

### Jest (Angular/NestJS — `init-states/angular-nest-team-crud`)

**Runner:**
- Jest via `@nx/jest` preset
- Config root: `init-states/angular-nest-team-crud/jest.config.ts` (aggregates projects via `getJestProjectsAsync`)
- Preset: `jest.preset.js` spreads `@nx/jest/preset`
- API project config: `init-states/angular-nest-team-crud/api/jest.config.ts`
- Web project config: `init-states/angular-nest-team-crud/web/jest.config.ts`

**Assertion Library:**
- Jest built-in `expect` (no additional library)

**Transforms:**
- API: `ts-jest` with `tsconfig.spec.json`
- Web: `jest-preset-angular` with `tsconfig.spec.json`, handles `.html`/`.svg` via `stringifyContentPathRegex`

**Run Commands:**
```bash
# From angular-nest-team-crud root (Nx)
npx nx test api          # Run API unit tests
npx nx test web          # Run Angular web unit tests
npx nx run-many --target=test  # Run all project tests
```

### Playwright (Visual Regression — `init-states/angular-20-storybook`)

**Runner:**
- Playwright Test
- Config: `init-states/angular-20-storybook/playwright.config.ts`
- `testDir: "./tests"`, `testMatch: /\.spec\.ts$/`
- Workers: 1 (sequential, `fullyParallel: false`, `retries: 0`)

**Run Commands:**
```bash
# From angular-20-storybook root
npm run build                  # Build Storybook static first (required)
npx playwright test            # Run all VRT specs
npx playwright show-report test-results/html  # View HTML report
```

## Test File Organization

**Jest (NestJS API) — `init-states/angular-nest-team-crud/api/src/app/`:**
- Co-located with source: `app.controller.spec.ts` sits next to `app.controller.ts`
- Pattern: `<name>.spec.ts`

**Jest (Angular Web) — `init-states/angular-nest-team-crud/web/src/app/`:**
- Co-located with source: `app.component.spec.ts` next to `app.component.ts`
- Pattern: `<name>.spec.ts`

**Playwright (VRT) — `init-states/angular-20-storybook/tests/visual/`:**
- Separate `tests/` directory at project root
- Single spec file: `tests/visual/storybook.spec.ts`
- Baseline screenshots stored alongside spec: `tests/visual/<story-id>/<viewport>.png`

**Structure:**
```
init-states/angular-nest-team-crud/
├── api/src/app/
│   ├── app.controller.ts
│   ├── app.controller.spec.ts    # co-located unit test
│   ├── app.service.ts
│   └── app.service.spec.ts       # co-located unit test
└── web/src/app/
    ├── app.component.ts
    └── app.component.spec.ts     # co-located unit test

init-states/angular-20-storybook/
└── tests/visual/
    ├── storybook.spec.ts         # single VRT driver spec
    └── <story-id>/               # one dir per Storybook story
        ├── mobile.png            # baseline screenshot
        ├── tablet.png
        └── desktop.png
```

## Test Structure

**NestJS Unit Tests — Suite Organization:**
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let app: TestingModule;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();
  });

  describe('getData', () => {
    it('should return "Hello API"', () => {
      const appController = app.get<AppController>(AppController);
      expect(appController.getData()).toEqual({ message: 'Hello API' });
    });
  });
});
```

**Angular Component Unit Tests:**
```typescript
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent, NxWelcomeComponent, RouterModule.forRoot([])],
    }).compileComponents();
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Welcome web');
  });
});
```

**Playwright VRT Tests — data-driven pattern:**
```typescript
// Story IDs discovered dynamically from filesystem
const STORY_IDS = readdirSync(VISUAL_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("."))
  .map((d) => d.name)
  .sort();

for (const storyId of STORY_IDS) {
  test.describe(storyId, () => {
    for (const vp of VIEWPORTS) {
      test(`${vp.id} (${vp.width}x${vp.height})`, async ({ page }) => {
        // navigate, disable animations, screenshot compare
        await expect(page).toHaveScreenshot([storyId, `${vp.id}.png`], {
          fullPage: true,
          maxDiffPixelRatio: 0.02,
        });
      });
    }
  });
}
```

**Patterns:**
- NestJS: `beforeAll` (not `beforeEach`) for expensive module compilation
- Angular: `beforeEach` with `async` for TestBed configuration
- VRT: `test.setTimeout(20_000)` set per test inside the test body
- No `afterEach`/`afterAll` teardown in current specs

## Mocking

**Angular (Jest):**
- `RouterModule.forRoot([])` used to provide router without actual routes
- Real `AppService` injected (no mocks) in `AppController` spec — simple integration-style unit test
- No `jest.mock()` or `jest.spyOn()` observed in current specs

**Playwright (VRT):**
- No HTTP mocking — tests hit the static Storybook build directly
- Animation suppression via injected CSS (`animation-duration: 0s`, `transition-duration: 0s`) to stabilize screenshots
- Font loading awaited: `await page.evaluate(() => document.fonts.ready)`

**What to Mock:**
- HTTP services when testing Angular components that make API calls (use `HttpClientTestingModule`)
- External services in NestJS unit tests (inject mocks as providers)

**What NOT to Mock:**
- Framework infrastructure (Angular `TestBed`, NestJS `Test.createTestingModule`) — use real instances
- Storybook stories (VRT tests test against the real rendered output)

## Fixtures and Factories

**Test Data:**
- No shared fixture factories detected — test data is inlined directly in specs
- NestJS specs create real module instances; no factory pattern for entity creation in tests

**Location:**
- `init-states/angular-nest-team-crud/web/src/test-setup.ts`: Angular test environment setup (imported via `setupFilesAfterEnv`)
- `init-states/angular-nest-team-crud/web/src/app/testing-decorators.ts`: Stub `@Component` and `@Injectable` decorators for non-Angular test contexts

## Coverage

**Requirements:** No coverage thresholds enforced

**Coverage Output Directories:**
- API: `coverage/api/` (relative to `angular-nest-team-crud` root)
- Web: `coverage/web/` (relative to `angular-nest-team-crud` root)

**View Coverage:**
```bash
npx nx test api --coverage
npx nx test web --coverage
```

## Test Types

**Unit Tests (Jest):**
- Scope: NestJS controller and service classes; Angular component rendering
- Location: Co-located `*.spec.ts` files in `init-states/angular-nest-team-crud/`
- Approach: Real NestJS `TestingModule` / Angular `TestBed` — minimal mocking

**Visual Regression Tests (Playwright):**
- Scope: All Storybook stories at three viewports (mobile 375px, tablet 768px, desktop 1280px)
- Location: `init-states/angular-20-storybook/tests/visual/storybook.spec.ts`
- Approach: Pixel diff against stored PNG baselines with `maxDiffPixelRatio: 0.02` tolerance
- Web server: `http-server storybook-static -p 6006` auto-started by Playwright config
- Custom reporter: `vrt-summary-reporter.ts` writes `test-results/SUMMARY.md`

**Integration / E2E Tests:**
- Not present in this repository

**Eval Runner (no tests):**
- The `eval-runner` package has no test suite — it is exercised by running actual benchmark jobs

**Harness (no tests):**
- The `harness/` package has no unit tests — correctness is verified by end-to-end benchmark runs

## Common Patterns

**Async Testing (NestJS):**
```typescript
beforeAll(async () => {
  app = await Test.createTestingModule({ ... }).compile();
});
```

**Async Testing (Angular):**
```typescript
beforeEach(async () => {
  await TestBed.configureTestingModule({ ... }).compileComponents();
});
```

**DOM Querying (Angular):**
```typescript
const fixture = TestBed.createComponent(AppComponent);
fixture.detectChanges();
const compiled = fixture.nativeElement as HTMLElement;
expect(compiled.querySelector('h1')?.textContent).toContain('...');
```

**Screenshot Comparison (Playwright):**
```typescript
await expect(page).toHaveScreenshot([storyId, `${vp.id}.png`], {
  fullPage: true,
  maxDiffPixelRatio: 0.02,
});
```

**Storybook Story Pattern:**
```typescript
// tasks/vrt/<component>/src/app/<component>/<component>.stories.ts
import type { Meta, StoryObj } from '@storybook/angular';
import { MyComponent } from './my-component';

const meta: Meta<MyComponent> = {
  title: 'App/My Component',
  component: MyComponent,
};
export default meta;
type Story = StoryObj<MyComponent>;
export const Default: Story = { args: {} };
```

---

*Testing analysis: 2026-06-04*
