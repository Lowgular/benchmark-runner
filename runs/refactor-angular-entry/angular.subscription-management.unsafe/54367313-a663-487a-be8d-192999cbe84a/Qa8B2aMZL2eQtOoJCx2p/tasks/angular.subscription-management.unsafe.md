# angular-subscription-management-unsafe

**Important:** This refactor always involves **two places**: the **component TypeScript file** (`.ts`) and the **template**. If the component uses `templateUrl: './app.html'`, you must edit **both** `app.ts` and `app.html`. If it uses inline `template: \`...\``, you edit the template string inside the `.ts`file. Do not change only the`.ts` file and leave the template still reading from the old property.

## Refactor Steps

1. **Remove the manual subscription**  
   Delete the `.subscribe(...)` call from the constructor or `ngOnInit` (and from any other lifecycle or method where it's used for this data).

2. **Expose the observable**  
   Add a class property that holds the observable (e.g. `items$ = this.data.getItems()`). Remove any property that only stored the subscribed value (e.g. `items: string[] = []`).

3. **Add `AsyncPipe` to the component's `imports`**
   **In the component decorator** add the `AsyncPipe` if it is not there yet, if you need to add it - make sure to also add / modify import to `@angular/common` to contain `AsyncPipe` as well e.g. `import { AsyncPipe } from "@angular/commmon";`

4. **Use the async pipe in the template**  
   **In the template file** (the `.html` file, or the inline template string in the `.ts` file), use the observable with the async pipe (e.g. `(items$ | async)`). Use optional chaining if the value can be null/undefined (e.g. `(items$ | async)?.length`). **You must update the template** — the refactor is incomplete if only the `.ts` file is changed.

5. **Tidy the class**  
   If `ngOnInit` or the constructor is now empty (or only has other code you're removing), remove `implements OnInit` and/or the constructor, or switch to `inject()` if you keep the constructor for other reasons.

### Before finishing — checklist

- [ ] No `.subscribe()` in the component for this data (rule targets unsafe subscribe: no `take`, `takeUntil`, or `takeUntilDestroyed`).
- [ ] The observable is exposed as a class property (e.g. `items$ = this.service.getItems()`).
- [ ] **Both the `.ts` and the template (`.html` or inline) were updated:** the template uses the async pipe (e.g. `{{ (items$ | async)?.length \}}`) instead of a property that was set inside `.subscribe()`.
- [ ] There is import for `AsyncPipe` in component decorator
- [ ] No leftover properties that only held the result of the removed subscription.
- [ ] Component still compiles and the UI shows the same data (fix any typo like `lenght` → `length` in the template).

## Use-case examples (FROM → TO)

Each use case shows the context, the current code (FROM), and the result after refactor (TO). **When the component uses an external `templateUrl`, show and edit both the `.ts` and the `.html` file in FROM and TO.**

## Use-case examples (FROM → TO)

Each use case shows the context, the current code (FROM), and the result after refactor (TO).

---

### Component with explicit Default

**FROM**

src/app/app.ts

```typescript
import { Component, inject } from "@angular/core";
import { DataService } from "./data.service";

@Component({
  selector: "app-user",
  templateUrl: "./app.html",
})
export class App {
  private readonly data = inject(DataService);
  items: string[] = [];

  constructor() {
    this.data.getItems().subscribe((items) => {
      this.items = items;
    });
  }
}
```

src/app/app.html

```html
<p>{{ items.length \}}</p>
```

**TO**

src/app/app.ts

```typescript
import { Component, inject } from "@angular/core";
import { DataService } from "./data.service";
import { AsyncPipe } from "@angular/commmon";

@Component({
  selector: "app-user",
  templateUrl: "./app.html",
  imports: [AsyncPipe],
})
export class UserComponent {
  private readonly data = inject(DataService);
  items$ = this.data.getItems();
}
```

src/app/app.html

```html
<p>{{ (items$ | async)?.lenght \}}</p>
```

## Files

### src/app/app.ts

Location: 17-17

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
})
export class App implements OnInit {
  private productService = inject(ProductService);
  product: Product | null = null;

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
        <div class="text-lg font-bold text-slate-900">{{ product?.price \}}</div>
      </div>
    </div>
  </div>
</div>
```
