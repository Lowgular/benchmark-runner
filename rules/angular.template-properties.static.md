# angular-template-properties-static-to-signal

**Common mistake:** Migrating only the TypeScript to a signal and **not** updating the template. The template must **call** the signal: use `user()?.name`, not `user?.name`. Otherwise the rule reports **signal-binding-error** instead of correct signal usage.

You must edit **both** the component TypeScript file and the template file (e.g. app.html). Do not skip the template. Prefer updating the template file first, then the TypeScript.

## Refactor Steps

**Rule:** Any template that reads the property must now call it: `prop` → `prop()`, and `prop?.x` → `prop()?.x`.

### 1. Update the template file (do this first)

- In every template that uses this property (e.g. app.html), replace **property** with **property()**: `product` → `product()`, `product?.x` → `product()?.x`. Do this for every binding (interpolations, attribute bindings, etc.).
- **If you do not change the template, the refactor is incomplete and will fail** (reported as signal-binding-error).

### 2. Component TypeScript file

1. Find the property that should be changed.
2. Change the type of the property from a normal TypeScript type to `Signal<T>` with that type as the generic (e.g. `Signal<User | undefined>`).
3. Find the place where the property is assigned and use that expression to initialize the signal (e.g. `toSignal(...)`).

- If it is set inside an RxJS callback (e.g. `.subscribe` or `tap`), prefer using `toSignal` directly.

4. Clean up the old code:

- Remove the old property assignment.
- If nothing else remains in the callback/method body, remove the entire callback/method.
- If the call site (e.g. `ngOnInit`, `constructor`, `effect`) is now empty, remove it too (and remove `implements OnInit` from the class if applicable).

### 3. Template file(s) — reminder

- In every template that binds to the property, change **property** to **property()** — e.g. `user?.name` → `user()?.name`.
- If you only change the .ts file and leave the .html with `product?.…`, the refactor is wrong and will be reported as **signal-binding-error**.

### Before finishing — checklist

- [ ] Component uses `Signal<T>` and `toSignal` (or equivalent).
- [ ] **Template file(s) use `property()` everywhere instead of `property`** (e.g. `product()?.name` not `product?.name`).

## Use-case examples (FROM → TO)

Each use case shows the context, the current code (FROM), and the result after refactor (TO).

---

### Component with explicit Default

**FROM**

src/app/app.ts

```typescript
import { Component, inject, OnInit } from "@angular/core";
import { User, UserService } from "./user.service";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
})
export class App implements OnInit {
  private readonly userService = inject(UserService);
  user: User | undefined;

  ngOnInit(): void {
    this.userService.getUser().subscribe((user) => {
      this.user = user;
    });
  }
}
```

src/app/app.html

```html
<p>{{ user?.name }}</p>
<p>{{ user?.email }}</p>
```

**TO**

src/app/app.ts

```typescript
import { Component, inject, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { User, UserService } from "./user.service";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
})
export class App {
  private readonly userService = inject(UserService);

  protected user: Signal<User | undefined> = toSignal(
    this.userService.getUser(),
    {
      initialValue: undefined,
    },
  );
}
```

src/app/app.html

```html
<p>{{ user()?.name }}</p>
<p>{{ user()?.email }}</p>
```

## Files

### src/app/app.ts

Location: 12-12

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
          ${{ product?.price?.toFixed(2) }}
        </div>
      </div>
    </div>
  </div>
</div>
```

**TO:** Apply the same pattern as in "Component with explicit Default" above: component uses `Signal<T>` and `toSignal`; template uses `property()` everywhere instead of `property` (e.g. `product()` not `product` in all bindings).
