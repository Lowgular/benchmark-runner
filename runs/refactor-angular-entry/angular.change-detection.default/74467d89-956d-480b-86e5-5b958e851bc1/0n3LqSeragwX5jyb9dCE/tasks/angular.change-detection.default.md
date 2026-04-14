# angular.change-detection.default

# change-detection_default_none

## Refactor Steps

1. Remove the `changeDetection: ChangeDetectionStrategy.Default` property from the decorator config object.
2. If `ChangeDetectionStrategy` is no longer used in the file, remove it from the `@angular/core` import.

## Use-case examples (FROM → TO)

Each use case shows the context, the current code (FROM), and the result after refactor (TO).

---

### Component with explicit Default

**FROM**

```typescript
import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "app-default",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  template: `<p>Default</p>`,
})
export class DefaultComponent {}
```

**TO**

```typescript
import { Component } from "@angular/core";

@Component({
  selector: "app-none",
  standalone: true,
  template: `<p>No changeDetection</p>`,
})
export class NoneComponent {}
```

## Files

### src/app/app.ts

Location: 9-9

### Full File Content

