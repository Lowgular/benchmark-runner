# angular.image-src-binding.attr-src-binding

## Refactor Steps

1. Add `NgOptimizedImage` to the component's `imports` (standalone) or the NgModule that declares the component.
2. Replace **`[attr.src]`** with **`[ngSrc]`** (or `ngSrc` for a static value) on the `<img>` tag.
3. Keep the same expression; NgOptimizedImage will use it for the optimized image source.
4. Double check the context because `ngSrc` attribute binding does not accept `nullish` values so to prevent build errors you can consider wrapping a block with `@if` control flow (at the top level where property is accessed)

## Use-case examples (FROM → TO)

---

### Bound attr.src in Component decorator

**_IMPORTANT_**: This example requires changes only in a Typescript file!

**FROM**

```typescript
import { Component } from "@angular/core";

@Component({
  selector: "app-attr-src",
  template: `<img [attr.src]="url" alt="" />`,
})
export class InlineComponent {}
```

**TO**

```typescript
import { NgOptimizedImage } from "@angular/common";
import { Component } from "@angular/core";

@Component({
  selector: "app-src",
  template: `<img [ngSrc]="a.jpg" alt="" />`,
  imports: [NgOptimizedImage],
})
export class InlineComponent {}
```

---

### Bound attr.src in Component template

**_IMPORTANT_**: This example requires changes in:

- HTML file (main change just like before)
- Typescript file because you need to add `NgOptimizedImage` to imports in component decorator!

**FROM**

```typescript
import { Component } from "@angular/core";

@Component({
  selector: "app-attr-src",
  templateUrl: "./html.component.html",
})
export class HtmlComponent {}
```

```html
<img [attr.src]="url" alt="" />
```

**TO**

```typescript
import { NgOptimizedImage } from "@angular/common";
import { Component } from "@angular/core";

@Component({
  templateUrl: "./html.component.html",
  imports: [NgOptimizedImage],
})
export class HtmlComponent {}
```

```html
<img [ngSrc]="url" alt="" />
```

## Files

### src/app/app.html

Location: 5-5

### Full File Content

src/app/app.ts

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

src/app/app.html

```html
<div class="min-h-screen bg-slate-50 flex items-center justify-center p-6">
  <div
    class="w-full max-w-2xl bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden"
  >
    <div class="flex flex-col md:flex-row">
      <div class="md:w-1/3 bg-slate-100 flex items-center justify-center p-6">
        <img
          class="h-40 w-40 object-contain"
          [attr.src]="product?.image"
          [alt]="product?.name"
        />
      </div>
      <div class="md:w-2/3 p-6 space-y-4">
        <h1 class="text-2xl font-semibold text-slate-900">
          {{ product?.name \}}
        </h1>
        <p class="text-sm text-slate-600 leading-relaxed">
          {{ product?.description \}}
        </p>
        <div class="text-lg font-bold text-slate-900">
          ${{ product?.price?.toFixed(2) \}}
        </div>
      </div>
    </div>
  </div>
</div>
```
