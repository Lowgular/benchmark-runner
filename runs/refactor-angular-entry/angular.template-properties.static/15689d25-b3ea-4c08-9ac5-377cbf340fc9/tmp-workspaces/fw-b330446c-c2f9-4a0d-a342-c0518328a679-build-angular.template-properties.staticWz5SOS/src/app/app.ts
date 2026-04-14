import { ChangeDetectionStrategy, Component } from "@angular/core";
import { Product } from "./product.model";
import { ProductService } from "./product.service";
import { Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
  styleUrls: ["./app.css"],
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
