---
name: angular-change-detection-default-to-none
description: Remove explicit changeDetection: ChangeDetectionStrategy.Default from Angular components and directives. In Angular 20 the default is OnPush; explicit Default is less optimal. Use when static analysis reports angular.change-detection.default.
---

# changeDetection: Default → none (remove)

## Purpose

Remove the **explicit** `changeDetection: ChangeDetectionStrategy.Default` from `@Component` and `@Directive` metadata. Rely on framework defaults instead of declaring Default. This aligns with Angular 20 where the recommended default behavior is OnPush.

## When to Use

- When static analysis or tooling reports `angular.change-detection.default`.
- When a component or directive has `changeDetection: ChangeDetectionStrategy.Default` in its decorator metadata.

## Refactor Steps

1. Remove the `changeDetection: ChangeDetectionStrategy.Default` property from the decorator config object.
2. If `ChangeDetectionStrategy` is no longer used in the file, remove it from the `@angular/core` import.

## Use-case examples (FROM → TO)

Each use case shows the context, the current code (FROM), and the result after refactor (TO).

---

### Component with explicit Default

**FROM**

```typescript
import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-user',
  template: '<div>Hello</div>',
  changeDetection: ChangeDetectionStrategy.Default
})
export class UserComponent { }
```

**TO**

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-user',
  template: '<div>Hello</div>',
})
export class UserComponent { }
```

---

### Directive with explicit Default

**FROM**

```typescript
import { Directive, ChangeDetectionStrategy } from '@angular/core';

@Directive({
  selector: '[test]',
  changeDetection: ChangeDetectionStrategy.Default
})
export class TestDirective { }
```

**TO**

```typescript
import { Directive } from '@angular/core';

@Directive({
  selector: '[test]',
})
export class TestDirective { }
```
