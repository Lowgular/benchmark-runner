---
name: angular-change-detection-on-push-to-none
description: Remove explicit changeDetection: ChangeDetectionStrategy.OnPush from Angular components and directives. In Angular 20 OnPush is the default; omitting the property is the desired behavior. Use when static analysis reports angular.change-detection.on-push.
---

# changeDetection: OnPush → none (remove)

## Purpose

Remove the **explicit** `changeDetection: ChangeDetectionStrategy.OnPush` from `@Component` and `@Directive` metadata. In Angular 20, OnPush is the default; declaring it explicitly is redundant. The desired state is to omit the property and rely on the default.

## When to Use

- When static analysis or tooling reports `angular.change-detection.on-push`.
- When a component or directive has `changeDetection: ChangeDetectionStrategy.OnPush` in its decorator metadata.

## Refactor Steps

1. Remove the `changeDetection: ChangeDetectionStrategy.OnPush` property from the decorator config object.
2. If `ChangeDetectionStrategy` is no longer used in the file, remove it from the `@angular/core` import.

## Use-case examples (FROM → TO)

Each use case shows the context, the current code (FROM), and the result after refactor (TO).

---

### Component with explicit OnPush

**FROM**

```typescript
import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-user',
  template: '<div>Hello</div>',
  changeDetection: ChangeDetectionStrategy.OnPush
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

### Directive with explicit OnPush

**FROM**

```typescript
import { Directive, ChangeDetectionStrategy } from '@angular/core';

@Directive({
  selector: '[test]',
  changeDetection: ChangeDetectionStrategy.OnPush
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

---

### Desired state (no change)

Component or directive with **no** `changeDetection` property — this is the target state (Angular 20 default is OnPush). No refactor needed.

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  template: '<div>Dashboard</div>',
})
export class DashboardComponent { }
```
