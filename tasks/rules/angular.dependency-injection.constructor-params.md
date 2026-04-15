# angular.dependency-injection.constructor-params

# constructor-params_inject-function

## Refactor Steps

1. **Import** `inject` from `@angular/core` (add to existing imports).
2. **For each constructor parameter** that is an injected dependency:
   - Remove the parameter from the constructor.
   - Add a class property initialized with `inject(DependencyClass)`.
3. **Constructor after migration:** If the constructor is empty, remove it entirely.

## Use-case examples (FROM → TO)

Each use case shows the context, the current code (FROM), and the result after refactor (TO).

---

### Component with router and service

Profile component that injects `Router` and `AuthService` via constructor.

**FROM**

```typescript
import { Component } from "@angular/core";
import { MyService } from "./my.service";

@Component({
  selector: "app-constructor-params",
  template: `<p>ctor</p>`,
})
export class ConstructorParamsComponent {
  constructor(private readonly service: MyService) {}
}
```

**TO**

```typescript
import { Component, inject } from "@angular/core";
import { MyService } from "./my.service";

class MyService {}

@Component({
  selector: "app-inject-function",
  template: `<p>inject</p>`,
})
export class InjectFunctionComponent {
  private readonly service = inject(MyService);
}
```

---

### Injectable service with HttpClient

Root-provided service that injects `HttpClient` in the constructor.

**FROM**

```typescript
import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";

@Injectable({ providedIn: "root" })
export class BadDataService {
  constructor(private http: HttpClient) {}
}
```

**TO**

```typescript
import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";

@Injectable({ providedIn: "root" })
export class DataService {
  private http = inject(HttpClient);
}
```

---

### Directive with ElementRef and Renderer2

Attribute directive that injects `ElementRef` and `Renderer2`.

**FROM**

```typescript
import { Directive, ElementRef, Renderer2 } from "@angular/core";

@Directive({ selector: "[appHighlight]" })
export class BadHighlightDirective {
  constructor(
    private elementRef: ElementRef,
    private renderer2: Renderer2,
  ) {}
}
```

**TO**

```typescript
import { Directive, ElementRef, inject, Renderer2 } from "@angular/core";

@Directive({ selector: "[appHighlight]" })
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
import { DatePipe } from "@angular/common";
import { Pipe, PipeTransform } from "@angular/core";

@Pipe({ name: "customDate" })
export class BadCustomDatePipe implements PipeTransform {
  constructor(private datePipe: DatePipe) {}

  transform(value: any): string {
    return this.datePipe.transform(value) || "";
  }
}
```

**TO**

```typescript
import { DatePipe } from "@angular/common";
import { Pipe, PipeTransform, inject } from "@angular/core";

@Pipe({ name: "customDate" })
export class CustomDatePipe implements PipeTransform {
  private datePipe = inject(DatePipe);

  transform(value: any): string {
    return this.datePipe.transform(value) || "";
  }
}
```

## Files

### src/app/product.service.ts

Location: 11-11

### Full File Content

```typescript
import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { Product } from "./product.model";

@Injectable()
export class ProductService {
  private readonly productUrl =
    "https://storage.googleapis.com/lowgular-platform/mocks/product.json";

  constructor(private http: HttpClient) {}

  getProduct(): Observable<Product> {
    return this.http.get<Product>(this.productUrl);
  }
}
```

---

### src/app/app.ts

Location: 14-14

### Full File Content

```typescript
import { ChangeDetectionStrategy, Component, OnInit } from "@angular/core";
import { Product } from "./product.model";
import { ProductService } from "./product.service";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
  styleUrl: "./app.css",
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
