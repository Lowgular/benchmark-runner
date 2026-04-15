# angular.change-detection.on-push

# change-detection_on-push_none

## Refactor Steps

1. Remove the `changeDetection: ChangeDetectionStrategy.OnPush` property from the decorator config object.
2. If `ChangeDetectionStrategy` is no longer used in the file, remove it from the `@angular/core` import.

## Use-case examples (FROM → TO)

Each use case shows the context, the current code (FROM), and the result after refactor (TO).

---

### Component with explicit OnPush

**FROM**

```typescript
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-on-push',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p>OnPush</p>`,
})
export class OnPushComponent {}

```

**TO**

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-none',
  standalone: true,
  template: `<p>No changeDetection</p>`,
})
export class NoneComponent {}

```

## Files

### src/app/product-card.ts

Location: 11-16

### Full File Content

```
import { NgIf } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
} from "@angular/core";
import { Product } from "./product.model";
import { ProductService } from "./product.service";

@Component({
  selector: "app-product-card",
  template: `<h1 *ngIf="product() as product">{{ product.name }}</h1>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIf],
})
export class App implements OnInit {
  product = signal<Product | null>(null);

  constructor(private productService: ProductService) {}

  ngOnInit(): void {
    this.productService.getProduct().subscribe((data) => {
      this.product.set(data);
    });
  }
}

```