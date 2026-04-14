# angular-template-formatting-component-format-method-to-pipe

## What this rule flags:

A component method is used in the template only to format a value (e.g. formatPrice(price) that returns price.toFixed(2) or similar). Prefer a built-in pipe in the template instead (e.g. number, currency, percent, date) and remove the format method.

You must edit both the component TypeScript file and the template. Prefer updating the template first, then cleaning up the TypeScript.

## Refactor steps

Rule: Replace template calls to the format method with a built-in pipe. Then remove the format method from the component.

1. Update the template (do this first)
   Find every interpolation (or binding) that calls the format method, e.g.:

   ```
   {{ formatPrice(product?.price ?? 0) }}
   ```

   Replace it with the same value passed through the appropriate built-in pipe:
   Currency / money: use the currency pipe, e.g.:

   ```
   {{ (product?.price ?? 0) | currency }}
   ```

   (optional args: 'USD', 'symbol', '1.2-2').
   Plain number with decimals: use the number pipe, e.g.:

   ```
   {{ value | number:'1.2-2' }}
   ```

   Percent: use the percent pipe.
   Date/time: use the date pipe with an optional format.
   Ensure the expression before the pipe is the value that was previously passed into the method (e.g. product?.price ?? 0), not the method call.
   If you do not change the template, the refactor is incomplete and the rule will still report the method.

2. Component TypeScript file
   Find the format method that is no longer used in the template (e.g. formatPrice(price: number): string { ... }).
   Remove the entire method.
   Remove unused imports if any (e.g. if nothing else uses them).
3. Template — reminder
   Every former call to the format method must be replaced by a pipe on the same value. Use value | pipeName (and optional pipe args), not formatMethod(value).

Before finishing — checklist
[ ] Template uses a built-in pipe (e.g. number, currency, percent, date) instead of calling the format method.
[ ] The format method has been removed from the component class.

## Use-case examples (FROM → TO)

Simplified examples showing the same pattern with minimal context.

---

### Currency formatting

**FROM**

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
  price = 10;

  formatPrice(): string {
    return `$${this.price.toFixed(2)}}`;
  }
}
```

src/app/app.html

```html
<p>{{ formatPrice(product?.price || 0) }}</p>
```

**TO**

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
  price = 10;
}
```

src/app/app.html

```html
<p>{{ price | currency }}</p>
```

## Files

### src/app/app.ts

Location: 22-24

### Full File Content

**FROM**

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

  formatPrice(price: number): string {
    return `$${price.toFixed(2)}}`;
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
          {{ product?.name }}
        </h1>
        <p class="text-sm text-slate-600 leading-relaxed">
          {{ product?.description }}
        </p>
        <div class="text-lg font-bold text-slate-900">
          {{ formatPrice(product?.price || 0) }}
        </div>
      </div>
    </div>
  </div>
</div>
```
