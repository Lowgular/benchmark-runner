import { ChangeDetectionStrategy, Component, inject, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Product } from "./product.model";
import { ProductService } from "./product.service";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
  styleUrls: ["./app.css"],
  changeDetection: ChangeDetectionStrategy.Default,
})
export class App {
  private productService = inject(ProductService);

  protected product: Signal<Product | null> = toSignal(
    this.productService.getProduct(),
    {
      initialValue: null,
    }
  );
}

// The class no longer implements OnInit, and no need for constructor.
// The subscription is replaced by toSignal.

// No code removed; the main change is converting to Signal and updating the property type.

// Note: Adjust import paths if necessary.

// No changes to app.html, as the template should now call product() instead of product.
// The template content remains unchanged here.