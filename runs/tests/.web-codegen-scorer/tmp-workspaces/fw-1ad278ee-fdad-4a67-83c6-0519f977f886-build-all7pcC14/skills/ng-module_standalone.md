---
name: angular-ngmodule-to-standalone
description: Migrate Angular NgModules to the standalone API. Convert components, directives, and pipes to standalone, then remove NgModules and update bootstrap, routing, and lazy loading. Use when static analysis detects NgModule usage to upgrade for tree-shaking, simpler structure, and modern Angular.
---

# NgModule to Standalone Migration Skill

## Purpose

This skill guides the agent to identify Angular NgModules and migrate the application to the standalone API. Standalone components, directives, and pipes declare their own dependencies via `standalone: true` and an `imports` array instead of being declared in an NgModule. The skill covers converting declarations to standalone, updating bootstrap and routing, and removing NgModule files.

## When to Use

- When static analysis or tooling reports NgModule usage (e.g. `angular.no-ngmodule`).
- When an Angular app uses `@NgModule` with `declarations`, `imports`, `exports`, or `providers`.
- When generating migration scripts, LSP fixes, or refactor suggestions for legacy Angular apps.

## Patterns

### Bad (Score 0)

- **NgModule**: Classes decorated with `@NgModule` that declare components, directives, pipes, and import other modules.
- **Problem**: NgModules add indirection, can hurt tree-shaking, and are no longer required in modern Angular. Standalone APIs are the default and recommended approach.

### Good (Score 1)

- **Standalone components, directives, pipes**: Each class has `standalone: true` and lists its template/code dependencies in `imports`. No NgModule files; bootstrap and routing use standalone APIs.
- **Benefits**: Clear dependency graph per component, better tree-shaking, simpler mental model, and alignment with Angular’s current direction.

## Refactor Steps

### 1. Convert components to standalone

- Add `standalone: true` to each `@Component`.
- Add an `imports` array to the component: include every directive, pipe, or child component used in the template (and `CommonModule` only if you use shared directives like `NgIf`, `NgFor`—or migrate those to control flow first).
- Remove the component from any NgModule `declarations` (and from `exports` if it was re-exported).

### 2. Convert directives to standalone

- Add `standalone: true` to each `@Directive`.
- Add `imports` only if the directive’s host or template depends on other directives/pipes/components; otherwise `imports: []`.
- Remove the directive from NgModule `declarations` / `exports`.

### 3. Convert pipes to standalone

- Add `standalone: true` to each `@Pipe`.
- Pipes rarely need `imports`; set `imports: []` if nothing is needed.
- Remove the pipe from NgModule `declarations` / `exports`.

### 4. Update bootstrap

- Replace `platformBrowserDynamic().bootstrapModule(AppModule)` with `bootstrapApplication(AppComponent, { providers: [...] })`.
- Move root-level providers from `AppModule` into the `providers` option of `bootstrapApplication`, or use `providedIn: 'root'` for services where appropriate.
- Remove `AppModule` and its file if it only existed for bootstrap.

### 5. Update routing

- Use `RouterModule.forRoot(routes)` only if you still need it for legacy reasons; prefer providing the router via `provideRouter(routes)` in `bootstrapApplication` or in a route config.
- For lazy loading, replace `loadChildren: () => import('./feature/feature.module').then(m => m.FeatureModule)` with `loadComponent: () => import('./feature/feature.component').then(m => m.FeatureComponent)` (and ensure the lazy component is standalone).
- Ensure lazy-loaded standalone components are loaded as components, not modules.

### 6. Remove NgModule files

- Delete the `.module.ts` file once all declarations are migrated and bootstrap/routing no longer reference it.
- Update any `import` statements that referenced the removed module (e.g. replace module imports with direct imports of standalone components/directives/pipes).

## Use-case examples (FROM → TO)

Each use case shows the context, the current code (FROM), and the result after refactor (TO).

---

### Root app: NgModule with component, directive, and pipe

App module declares a root component that uses a directive and a pipe; bootstrap is via `bootstrapModule`.

**FROM**

```typescript
// app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { HighlightDirective } from './highlight.directive';
import { TruncatePipe } from './truncate.pipe';

@NgModule({
  declarations: [AppComponent, HighlightDirective, TruncatePipe],
  imports: [BrowserModule],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

```typescript
// app.component.ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: '<p appHighlight>{{ title | truncate:20 }}</p>',
})
export class AppComponent {
  title = 'My App';
}
```

```typescript
// highlight.directive.ts
import { Directive, ElementRef } from '@angular/core';

@Directive({ selector: '[appHighlight]' })
export class HighlightDirective {
  constructor(private el: ElementRef) {}
}
```

```typescript
// truncate.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'truncate' })
export class TruncatePipe implements PipeTransform {
  transform(value: string, max: number): string {
    return value.length <= max ? value : value.slice(0, max) + '…';
  }
}
```

**TO**

```typescript
// app.component.ts
import { Component } from '@angular/core';
import { HighlightDirective } from './highlight.directive';
import { TruncatePipe } from './truncate.pipe';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [HighlightDirective, TruncatePipe],
  template: '<p appHighlight>{{ title | truncate:20 }}</p>',
})
export class AppComponent {
  title = 'My App';
}
```

```typescript
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent);
```

```typescript
// highlight.directive.ts
import { Directive, ElementRef } from '@angular/core';

@Directive({ selector: '[appHighlight]', standalone: true })
export class HighlightDirective {
  constructor(private el: ElementRef) {}
}
```

```typescript
// truncate.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'truncate', standalone: true })
export class TruncatePipe implements PipeTransform {
  transform(value: string, max: number): string {
    return value.length <= max ? value : value.slice(0, max) + '…';
  }
}
```

Delete `app.module.ts`. Update `main.ts` to use `bootstrapApplication(AppComponent)`.

---

### Lazy-loaded feature module → standalone component

Feature is lazy-loaded via `loadChildren` and a feature NgModule.

**FROM**

```typescript
// feature.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatureComponent } from './feature.component';
import { RouterModule } from '@angular/router';

@NgModule({
  declarations: [FeatureComponent],
  imports: [CommonModule, RouterModule],
})
export class FeatureModule {}
```

```typescript
// app.routes.ts
{ path: 'feature', loadChildren: () => import('./feature/feature.module').then(m => m.FeatureModule) }
```

**TO**

```typescript
// feature.component.ts
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-feature',
  standalone: true,
  imports: [RouterModule],
  template: '<h1>Feature</h1>',
})
export class FeatureComponent {}
```

```typescript
// app.routes.ts
{ path: 'feature', loadComponent: () => import('./feature/feature.component').then(m => m.FeatureComponent) }
```

Delete `feature.module.ts`.

---

### Services and providers

- Prefer `providedIn: 'root'` for app-wide services so no NgModule is needed.
- For feature or route-level providers, use the `providers` array in `bootstrapApplication`, in route config, or in `EnvironmentInjector` when creating components dynamically.
- Do not reintroduce NgModules only to provide services; use the injector hierarchy and `providers` instead.
