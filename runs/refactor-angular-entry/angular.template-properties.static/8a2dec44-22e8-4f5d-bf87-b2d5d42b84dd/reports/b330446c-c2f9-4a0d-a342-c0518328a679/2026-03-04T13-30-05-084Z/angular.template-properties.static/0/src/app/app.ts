import { ChangeDetectionStrategy, Component, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Product } from "./product.model";
import { ProductService } from "./product.service";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
  styleUrl: "./app.css",
  changeDetection: ChangeDetectionStrategy.Default,
})
export class App {
  protected product: Signal<Product | null> = toSignal(
    this.productService.getProduct(),
    {
      initialValue: null,
    },
  );

  constructor(private productService: ProductService) {}
}
