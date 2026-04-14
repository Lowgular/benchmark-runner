# angular.provided-in-root.not-root

# angular-provided-in-root-not-root-to-root

## Refactor Steps

1. Add or update the **`providedIn`** property in the `@Injectable()` config to **`'root'`**.
2. If the service was previously provided in a module, remove it from that module’s `providers` (the root injector will provide it).
3. Keep other `@Injectable()` options (e.g. `providedIn: 'root'` with other metadata) as needed.

## Use-case examples (FROM → TO)

Each use case shows the context, the current code (FROM), and the result after refactor (TO).

---

**FROM**

```typescript
import { Injectable } from "@angular/core";

@Injectable({
  providedIn: "platform",
})
export class Service {}
```

**TO**

```typescript
import { Injectable } from "@angular/core";

@Injectable({
  providedIn: "root",
})
export class Service {}
```

---

**FROM**

```typescript
import { Injectable } from "@angular/core";

@Injectable({
  providedIn: "any",
})
export class Service {}
```

**TO**

```typescript
import { Injectable } from "@angular/core";

@Injectable({
  providedIn: "root",
})
export class Service {}
```

---

**FROM**

```typescript
import { Injectable } from "@angular/core";

@Injectable()
export class Service {}
```

**TO**

```typescript
import { Injectable } from "@angular/core";

@Injectable({
  providedIn: "root",
})
export class Service {}
```

## Files

### src/app/product.service.ts

Location: 6-6

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
