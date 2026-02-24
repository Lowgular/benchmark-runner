---
name: angular-constructor-params-to-inject
description: Migrate Angular dependency injection from constructor parameters to the inject() function in components, directives, pipes, and injectable services. Use when static analysis reports angular.dependency-injection.constructor-params to refactor for modern Angular patterns.
---

# Constructor Params → inject() Migration Skill

## Purpose

This skill automates migration from **constructor-based dependency injection** to **`inject()`** in Angular classes decorated with `@Component`, `@Directive`, `@Pipe`, or `@Injectable`. The goal is to remove DI parameters from constructors and replace them with class properties initialized with `inject(Token)`.

## When to Use

- When static analysis or tooling reports `angular.dependency-injection.constructor-params` (constructor parameters used for DI in decorated classes).
- When refactoring Angular components, directives, pipes, or injectable services that use constructor injection.

## Patterns

### Bad (Score 0) — Constructor params for DI

- Classes with `@Component`, `@Directive`, `@Pipe`, or `@Injectable` that inject dependencies via constructor parameters.
- Example: `constructor(private router: Router, private authService: AuthService) {}`

### Good (Score 1) — inject() only

- Same decorated classes use class properties initialized with `inject(SomeToken)`.
- No constructor, or constructor only when it has a non-empty body for other logic (no DI params).

## Refactor Steps

1. **Import** `inject` from `@angular/core` (add to existing imports).
2. **For each constructor parameter** that is an injected dependency:
   - Remove the parameter from the constructor.
   - Add a class property (e.g. `private readonly` or `private`) initialized with `inject(DependencyClass)`.
3. **Constructor after migration:** If the constructor is empty, remove it entirely.

## Use-case examples (FROM → TO)

Each use case shows the context, the current code (FROM), and the result after refactor (TO).

---

### Component with router and service

Profile component that injects `Router` and `AuthService` via constructor.

**FROM**

```typescript
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-profile',
  template: '<div>Profile</div>',
})
export class BadProfileComponent {
  constructor(
    private router: Router,
    private authService: AuthService,
  ) {}
}
```

**TO**

```typescript
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-profile',
  template: '<div>Profile</div>',
})
export class ProfileComponent {
  private router = inject(Router);
  private authService = inject(AuthService);
}
```

---

### Injectable service with HttpClient

Root-provided service that injects `HttpClient` in the constructor.

**FROM**

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class BadDataService {
  constructor(private http: HttpClient) {}
}
```

**TO**

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class DataService {
  private http = inject(HttpClient);
}
```

---

### Directive with ElementRef and Renderer2

Attribute directive that injects `ElementRef` and `Renderer2`.

**FROM**

```typescript
import { Directive, ElementRef, Renderer2 } from '@angular/core';

@Directive({ selector: '[appHighlight]' })
export class BadHighlightDirective {
  constructor(
    private elementRef: ElementRef,
    private renderer2: Renderer2,
  ) {}
}
```

**TO**

```typescript
import { Directive, inject } from '@angular/core';
import { ElementRef } from '@angular/core';
import { Renderer2 } from '@angular/core';

@Directive({ selector: '[appHighlight]' })
export class HighlightDirective {
  private elementRef = inject(ElementRef);
  private renderer2 = inject(Renderer2);
}
```

---

### Pipe with DatePipe

Pipe that uses `DatePipe` in its `transform` method.

**FROM**

```typescript
import { Pipe, PipeTransform } from '@angular/core';
import { DatePipe } from '@angular/common';

@Pipe({ name: 'customDate' })
export class BadCustomDatePipe implements PipeTransform {
  constructor(private datePipe: DatePipe) {}

  transform(value: any): string {
    return this.datePipe.transform(value) || '';
  }
}
```

**TO**

```typescript
import { Pipe, PipeTransform, inject } from '@angular/core';
import { DatePipe } from '@angular/common';

@Pipe({ name: 'customDate' })
export class CustomDatePipe implements PipeTransform {
  private datePipe = inject(DatePipe);

  transform(value: any): string {
    return this.datePipe.transform(value) || '';
  }
}
```
