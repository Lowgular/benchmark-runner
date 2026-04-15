# angular.observable-to-signal.subscribe-set

# observable-to-signal_subscribe-set_to-signal

## Refactor Steps

1. **Import** `toSignal` from `@angular/core/rxjs-interop` (or the appropriate package for your Angular version).
2. **Replace** the pattern: remove the subscription (e.g. in constructor or lifecycle hook), and initialize the property with `toSignal(theObservable$)`.
3. **Remove** any manual `subscribe()` that only called `this.<prop>.set(...)`; ensure the Observable is passed to `toSignal()` instead.
4. **Inject** `DestroyRef` if you need a custom injector for `toSignal()` (e.g. `toSignal(obs$, { injector: inject(DestroyRef) })`); otherwise the default context is usually sufficient.

## Use-case examples (FROM → TO)

Each use case shows the context, the current code (FROM), and the result after refactor (TO).

---

### Component: subscribe + .set() on a signal

**FROM**

```typescript
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { DataService } from './data.service';

@Component({
  selector: 'app-user',
  template: `{{ items().length }}`,
  imports: [CommonModule],
})
export class UserComponent implements OnInit {
  readonly items = signal<string[]>([]);

  private readonly data = inject(DataService);

  ngOnInit(): void {
    this.data.getItems().subscribe((list) => {
      this.items.set(list);
    });
  }
}

```

**TO**

```typescript
import { Component } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DataService } from './data.service';

@Component({
  selector: 'app-user',
  template: `{{ items().length }}`,
})
export class UserComponent {
  private readonly data: DataService;

  protected readonly items = toSignal(this.data.getItems(), {
    initialValue: null,
  });
}

```

---

### Service or class: observable stored in signal via subscribe

**FROM**

```typescript
import { signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export class MyService {
  private http = inject(HttpClient);
  data = signal<Item[] | null>(null);

  constructor() {
    this.http.get<Item[]>('/api/items').subscribe((res) => {
      this.data.set(res);
    });
  }
}

```

**TO**

```typescript
import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Item } from './item.model';

export class MyService {
  private http = inject(HttpClient);
  readonly data = toSignal(this.http.get<Item[]>('/api/items'), {
    initialValue: null,
  });
}

```

## Files

### src/app/product-card.ts

Location: 18-18

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