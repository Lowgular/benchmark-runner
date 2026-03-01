# angular.change-detection.default

# changeDetection: Default → none (remove)

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
  changeDetection: ChangeDetectionStrategy.Default,
})
export class UserComponent {}
```

**TO**

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-user',
  template: '<div>Hello</div>',
})
export class UserComponent {}
```

---

### Directive with explicit Default

**FROM**

```typescript
import { Directive, ChangeDetectionStrategy } from '@angular/core';

@Directive({
  selector: '[test]',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class TestDirective {}
```

**TO**

```typescript
import { Directive } from '@angular/core';

@Directive({
  selector: '[test]',
})
export class TestDirective {}
```

## Files

### src/app/app.ts

Location: 5-11

### Full File Content

```
import { ChangeDetectionStrategy, Component, OnInit } from "@angular/core";
import { Product } from "./product.model";
import { ProductService } from "./product.service";

@Component({
  selector: "app-root",
  templateUrl: "/src/app/app.html",
  styleUrl: "/src/app/app.css",
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Default,
})
export class App implements OnInit {
  product: Product | null = null;

  constructor(private productService: ProductService) {}

  ngOnInit(): void {
    this.productService.getProduct().subscribe((data) => {
      this.product = data;
    });
  }
}

```